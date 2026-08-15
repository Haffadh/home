"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import {
  MEAL_ICON,
  MEAL_LABEL,
  MEAL_ORDER,
  type MealType,
} from "@/app/components/MenuCard";
import { DUR, EASE } from "@/lib/design/tokens";
import { useInstantMotion } from "@/lib/design/motion";

/* ── Shape of /dashboard/summary, verbatim. ──────────────────────────────── */

type Summary = {
  menu: Record<MealType, string | null>;
  tasks: {
    done: number;
    total: number;
    next: { title: string; window_start: string; window_end: string }[];
  };
  pendingRequests: number;
};

const TOKEN_KEY = "shh_dashboard_token";
/* Last good summary, so a reboot shows the household's day instead of nothing.
   Stamped with the day it was fetched and discarded if that day has passed —
   a wall screen showing yesterday's menu as if it were today is worse than a
   wall screen admitting it has nothing. */
const CACHE_KEY = "shh_dashboard_last";
const REFRESH_MS = 60_000;
/* Comfortably inside the refresh cycle, so a stalled attempt is always
   resolved one way or the other before the next one starts. */
const REQUEST_TIMEOUT_MS = 15_000;

type Cached = { data: Summary; at: number; day: string };

/**
 * What the screen currently knows.
 *
 *  first-load  no answer yet, this session — the only state that may skeleton
 *  live        the last request succeeded
 *  unreachable the request failed (network, DNS, TLS, hub down)
 *  rejected    the hub answered 401/403 — this screen's token is not accepted
 *
 * `rejected` is split out from `unreachable` because the two need opposite
 * things from a human: one recovers by itself, the other never will.
 */
type Health = "first-load" | "live" | "unreachable" | "rejected";

/** The server's notion of "today" — same expression it uses. */
function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A timestamp as a wall clock reading. */
function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* Burn-in care: the whole layout drifts through these offsets, one step every
   three minutes, moving over a full minute — far below the threshold of
   noticing, far above the threshold of an OLED caring. */
const DRIFT: [number, number][] = [
  [0, 0],
  [5, 2],
  [8, -2],
  [4, 6],
  [-2, 3],
  [-6, -2],
  [-3, -6],
  [2, -3],
];
const DRIFT_STEP_MS = 180_000;

/** "08:00:00" (DB time) → "08:00" (wall display). */
function hm(t: string): string {
  return t.slice(0, 5);
}

/* ── Crossfade primitive ─────────────────────────────────────────────────────
   An invisible copy of the current content holds the box; the visible copies
   are absolutely stacked over it, so old and new genuinely crossfade with zero
   layout shift. Under prefers-reduced-motion the swap is instant. ─────────── */
function Fade({
  k,
  children,
  className = "",
  block = false,
}: {
  k: string;
  children: ReactNode;
  className?: string;
  block?: boolean;
}) {
  const reduce = useInstantMotion();
  const Outer = block ? "div" : "span";
  return (
    <Outer className={`relative ${block ? "" : "inline-block"} ${className}`}>
      <span aria-hidden className="invisible block">
        {children}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={k}
          className="absolute inset-0 block"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : DUR.ambient } }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: DUR.ambient, ease: EASE.inOut }
          }
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </Outer>
  );
}

export default function DashboardPage() {
  /* Same rule everywhere: no animation the viewer can't see. */
  const reduceMotion = useInstantMotion();

  /* ── Pairing: read ?token= once, keep it in localStorage, clean the URL ── */
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  /* ── Data: one request per cycle, last good data wins ──────────────────── */
  const [data, setData] = useState<Summary | null>(null);
  const [lastGoodAt, setLastGoodAt] = useState<number | null>(null);
  const [health, setHealth] = useState<Health>("first-load");
  const [failures, setFailures] = useState(0);
  const [everLive, setEverLive] = useState(false);

  /* Pairing, cache hydration, and — critically — a guarantee that `tokenChecked`
     is set no matter what. Reading or writing localStorage can throw outright
     (a locked-down or storage-blocked WebView), and when that happened the whole
     effect unwound: no token, no tokenChecked, and the page rendered nothing at
     all, not even the "isn't paired" message. A `finally` closes that. */
  useEffect(() => {
    let stored: string | null = null;
    try {
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get("token");
      if (fromQuery) {
        /* Held in memory as well as written, so a freshly paired screen works
           for this session even where the write is refused. */
        stored = fromQuery;
        try {
          localStorage.setItem(TOKEN_KEY, fromQuery);
        } catch {
          /* ignore — the in-memory copy still pairs this session */
        }
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
      if (!stored) {
        try {
          stored = localStorage.getItem(TOKEN_KEY);
        } catch {
          stored = null;
        }
      }
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as Cached;
          if (cached?.data && cached.day === dayKey()) {
            setData(cached.data);
            setLastGoodAt(cached.at);
          }
        }
      } catch {
        /* a corrupt or unreadable cache is simply no cache */
      }
    } finally {
      setToken(stored);
      setTokenChecked(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!token) return;

    /* A request that never answers is not an error, and without this it would
       leave `health` at "first-load" for ever — the skeleton back on screen
       indefinitely, which is the exact failure this whole change exists to
       remove. Captive portals, black-holed packets and stalled TLS handshakes
       all hang rather than fail. Aborting turns a hang into words on the wall.
       AbortController + setTimeout rather than AbortSignal.timeout, because
       the tablet's iOS version is not known. */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/dashboard/summary", {
        headers: { "X-Dashboard-Token": token },
        cache: "no-store",
        signal: controller.signal,
      });

      /* The hub answered, and said no. Retrying cannot fix this — the token in
         this screen's storage is not one the hub accepts — so it is reported as
         its own state instead of being counted as another silent timeout. The
         token is deliberately NOT cleared: a deploy that drops DASHBOARD_TOKEN
         server-side (§9) would otherwise unpair a perfectly good tablet, and
         this screen recovers on its own the moment the hub is fixed. */
      if (res.status === 401 || res.status === 403) {
        setHealth("rejected");
        setFailures((f) => f + 1);
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "bad response");

      const at = Date.now();
      setData(json.data as Summary);
      setLastGoodAt(at);
      setHealth("live");
      setEverLive(true);
      setFailures(0);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: json.data, at, day: dayKey() } satisfies Cached)
        );
      } catch {
        /* no cache is survivable; a thrown write must not lose the render */
      }
    } catch {
      setHealth("unreachable");
      setFailures((f) => f + 1);
    } finally {
      clearTimeout(timeout);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void load();
    const iv = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(iv);
  }, [token, load]);

  /* ── Clock: local, every second, never via API ─────────────────────────── */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* ── Burn-in drift ─────────────────────────────────────────────────────── */
  const [driftIndex, setDriftIndex] = useState(0);
  useEffect(() => {
    const iv = setInterval(
      () => setDriftIndex((i) => (i + 1) % DRIFT.length),
      DRIFT_STEP_MS
    );
    return () => clearInterval(iv);
  }, []);
  const [dx, dy] = DRIFT[driftIndex];

  const clock = now
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    : "00:00";

  const dateLine = now
    ? now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  const tasks = data?.tasks;
  const allDone = !!tasks && tasks.total > 0 && tasks.done >= tasks.total;
  const progressPct = tasks && tasks.total > 0 ? (tasks.done / tasks.total) * 100 : 0;

  /* Once a live answer has been seen, tolerate two missed cycles before saying
     anything — a single blip means the figures are at most three minutes old,
     and a flapping indicator on a wall is just noise. Before any live answer
     this session (a reboot rendering from cache), say so on the first failure:
     there is nothing yet to protect, and the numbers on screen are unconfirmed.
     A rejection is never transient, so it is never debounced. */
  const degraded =
    health === "rejected" || failures >= (everLive ? 3 : 1);
  const stale = !!data && degraded;

  return (
    <div className="theme-hearth theme-hearth-root hearth-safe-area relative h-dvh overflow-hidden select-none">
      <div
        className="h-full w-full"
        style={{
          transform: `translate(${dx}px, ${dy}px)`,
          transition: reduceMotion ? undefined : "transform 60s linear",
        }}
      >
        {/* Not paired. Read at two metres by whoever walks past first, which is
            a family member, not the person who set the screen up. */}
        {tokenChecked && !token && (
          <div className="flex h-full flex-col items-center justify-center gap-h5 px-h16 text-center">
            <p className="text-h3 font-semibold text-hearth-accent">
              This screen needs pairing
            </p>
            <p className="max-w-[24em] text-h5 text-hearth-ink-2">
              Open the dashboard link with its pairing token once on this
              tablet, and the day&apos;s menu and tasks will appear here.
            </p>
          </div>
        )}

        {token && (
          <div
            className={
              "grid h-full gap-h10 p-h10 " +
              "portrait:grid-rows-[auto_1fr] portrait:content-start " +
              "landscape:grid-cols-[1.1fr_1fr] landscape:items-center landscape:p-h16"
            }
          >
            {/* ── Clock — the dominant element ─────────────────────────── */}
            <div className="min-w-0 portrait:pt-h8">
              <p
                className="h-tnum text-h1 font-semibold leading-none tracking-[-0.03em] text-hearth-ink"
                aria-live="off"
              >
                {clock}
              </p>
              <p className="mt-h4 text-h4 font-normal text-hearth-ink-2">
                {dateLine || " "}
              </p>
            </div>

            {/* ── Data column ────────────────────────────────────────────
                 Every branch below says something a person can read from
                 across the room. The skeleton is reachable only while the
                 first request of the session is genuinely in flight — it used
                 to be the resting state of every failure, three pale blocks
                 pulsing for ever on a screen that looked simply broken. */}
            {!data && health === "rejected" ? (
              <div className="flex min-w-0 flex-col gap-h5" role="status">
                <p className="text-h3 font-semibold text-hearth-accent">
                  This screen needs re-pairing
                </p>
                <p className="text-h5 text-hearth-ink-2">
                  The hub is answering, but it will not accept this screen&apos;s
                  pairing token. Open the dashboard link with the token once on
                  this tablet to fix it.
                </p>
                <p className="text-h7 text-hearth-ink-3">
                  Refused {failures === 1 ? "once" : `${failures} times`} · token
                  held here is {token?.length ?? 0} characters
                </p>
              </div>
            ) : !data && health === "unreachable" ? (
              <div className="flex min-w-0 flex-col gap-h5" role="status">
                <p className="text-h3 font-semibold text-hearth-accent">
                  Can&apos;t reach the hub
                </p>
                <p className="text-h5 text-hearth-ink-2">
                  This screen is still trying, and will fill itself in the
                  moment the hub answers.
                </p>
                <p className="text-h7 text-hearth-ink-3">
                  No answer for {failures === 1 ? "1 attempt" : `${failures} attempts`}
                </p>
              </div>
            ) : !data ? (
              /* First request in flight: skeleton matched to the real block
                 heights, and never on screen for more than one cycle. */
              <div className="flex min-w-0 flex-col gap-h10" aria-hidden>
                <div className="h-[168px] animate-pulse rounded-h-lg bg-hearth-sunk" />
                <div className="h-[104px] animate-pulse rounded-h-lg bg-hearth-sunk" />
                <div className="h-[180px] animate-pulse rounded-h-lg bg-hearth-sunk" />
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-h10">
                {/* Menu — unset slots are a quiet dash, never an error. */}
                <ul className="flex flex-col gap-h4">
                  {MEAL_ORDER.map((slot) => {
                    const Icon = MEAL_ICON[slot];
                    const name = data.menu[slot];
                    return (
                      <li key={slot} className="flex items-center gap-h4">
                        <Icon
                          size={28}
                          aria-hidden
                          className="shrink-0 text-hearth-ink-3"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-h9 text-hearth-ink-3">
                            {MEAL_LABEL[slot]}
                          </p>
                          <Fade
                            k={name ?? "—"}
                            block
                            className="text-h5 font-medium"
                          >
                            {name ? (
                              <span className="text-hearth-ink">{name}</span>
                            ) : (
                              <span className="text-hearth-ink-3">—</span>
                            )}
                          </Fade>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Progress — numerals + the hairline accent track. */}
                <div>
                  <Fade k={`${tasks!.done}/${tasks!.total}`} block>
                    <p className="flex items-baseline gap-h3">
                      <span className="h-tnum text-h2 font-semibold leading-none tracking-[-0.02em] text-hearth-ink">
                        {tasks!.done}
                      </span>
                      <span className="text-h6 text-hearth-ink-3">
                        of {tasks!.total} done
                      </span>
                    </p>
                  </Fade>
                  <div
                    className="mt-h4 h-h1 w-full overflow-hidden rounded-h-pill bg-hearth-sunk"
                    role="progressbar"
                    aria-valuenow={tasks!.done}
                    aria-valuemin={0}
                    aria-valuemax={tasks!.total}
                    aria-label="Tasks done today"
                  >
                    <motion.div
                      className="h-full rounded-h-pill bg-hearth-accent"
                      initial={false}
                      animate={{ width: `${progressPct}%` }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: DUR.ambient, ease: EASE.inOut }
                      }
                    />
                  </div>
                </div>

                {/* Up next — or the one calm all-finished state. */}
                <Fade
                  k={
                    allDone
                      ? "all-done"
                      : tasks!.total === 0
                        ? "no-tasks"
                        : tasks!.next
                            .map((t) => `${t.title}@${t.window_start}`)
                            .join("|")
                  }
                  block
                >
                  {allDone ? (
                    <p className="flex items-center gap-h3 text-h5 font-medium text-hearth-ink">
                      <Check
                        size={26}
                        weight="bold"
                        aria-hidden
                        className="text-hearth-done"
                      />
                      All finished today
                    </p>
                  ) : tasks!.total === 0 ? (
                    <p className="text-h5 text-hearth-ink-3">No tasks today</p>
                  ) : (
                    <div>
                      <p className="mb-h3 text-h9 text-hearth-ink-3">Up next</p>
                      <ul className="flex flex-col gap-h3">
                        {tasks!.next.map((t) => (
                          <li
                            key={`${t.title}@${t.window_start}`}
                            className="flex items-baseline justify-between gap-h4"
                          >
                            <span className="min-w-0 flex-1 truncate text-h5 font-medium text-hearth-ink">
                              {t.title}
                            </span>
                            <span className="h-tnum shrink-0 text-h7 text-hearth-ink-3">
                              {hm(t.window_start)}–{hm(t.window_end)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Fade>

                {/* Family requests — a quiet count, or nothing at all. */}
                <AnimatePresence initial={false}>
                  {data.pendingRequests > 0 && (
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{
                        opacity: 0,
                        transition: { duration: reduceMotion ? 0 : DUR.ambient },
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: DUR.ambient, ease: EASE.inOut }
                      }
                      className="flex items-center gap-h3 text-h7 text-hearth-ink-2"
                    >
                      <span
                        aria-hidden
                        className="inline-block size-[8px] rounded-h-pill bg-hearth-accent"
                      />
                      <Fade k={String(data.pendingRequests)}>
                        {data.pendingRequests === 1
                          ? "1 request waiting"
                          : `${data.pendingRequests} requests waiting`}
                      </Fade>
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Stale: the figures above are real, they are just not
                    current. Still a dot and not a banner — but an accent dot
                    at a size that exists, next to words at the same scale as
                    the rest of the column, and it says how old the numbers
                    are. The old indicator was a 10px hairline-grey dot in a
                    corner, which at two metres is indistinguishable from a
                    dashboard that is simply working. */}
                <AnimatePresence initial={false}>
                  {stale && (
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{
                        opacity: 0,
                        transition: { duration: reduceMotion ? 0 : DUR.ambient },
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: DUR.ambient, ease: EASE.inOut }
                      }
                      className="flex items-center gap-h3 text-h6 font-medium text-hearth-ink-2"
                      role="status"
                    >
                      <span
                        aria-hidden
                        className="inline-block size-[14px] shrink-0 rounded-h-pill bg-hearth-accent"
                      />
                      <span>
                        {health === "rejected"
                          ? "Needs re-pairing"
                          : "Can't reach the hub"}
                        {lastGoodAt
                          ? ` · last updated ${hhmm(lastGoodAt)}`
                          : ""}
                      </span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
