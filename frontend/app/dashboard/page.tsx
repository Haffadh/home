"use client";

import {
  useCallback,
  useEffect,
  useRef,
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
const REFRESH_MS = 60_000;

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

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) {
      localStorage.setItem(TOKEN_KEY, fromQuery);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    setToken(localStorage.getItem(TOKEN_KEY));
    setTokenChecked(true);
  }, []);

  /* ── Data: one request per cycle, last good data wins ──────────────────── */
  const [data, setData] = useState<Summary | null>(null);
  const failuresRef = useRef(0);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/dashboard/summary", {
        headers: { "X-Dashboard-Token": token },
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "bad response");
      setData(json.data as Summary);
      failuresRef.current = 0;
      setOffline(false);
    } catch {
      failuresRef.current += 1;
      if (failuresRef.current >= 3) setOffline(true);
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

  return (
    <div className="theme-hearth theme-hearth-root relative h-dvh overflow-hidden select-none">
      <div
        className="h-full w-full"
        style={{
          transform: `translate(${dx}px, ${dy}px)`,
          transition: reduceMotion ? undefined : "transform 60s linear",
        }}
      >
        {/* Not paired: the only state that speaks to a human installer. */}
        {tokenChecked && !token && (
          <div className="flex h-full items-center justify-center px-h16">
            <p className="max-w-[26em] text-center text-h5 text-hearth-ink-2">
              This screen isn&apos;t paired. Open{" "}
              <span className="h-tnum">/dashboard?token=&hellip;</span> once on
              this device to pair it.
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

            {/* ── Data column ──────────────────────────────────────────── */}
            {!data ? (
              /* First load only: skeleton matched to the real block heights. */
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offline: a dot, not a banner. The stale data on screen is still the
          most useful thing to show. */}
      <AnimatePresence>
        {offline && (
          <motion.span
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
            className="absolute bottom-h5 right-h5 size-[10px] rounded-h-pill bg-hearth-line-strong"
            role="status"
            aria-label="Offline — showing last update"
            title="Offline — showing last update"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
