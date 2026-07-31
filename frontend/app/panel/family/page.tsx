"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, PaperPlaneTilt } from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Card,
  CardLabel,
  Input,
  PageShell,
  Section,
  Textarea,
} from "@/app/components/ui";
import {
  MenuCard,
  menuFromMeals,
  hasAnyMeal,
  EMPTY_MENU,
  type Meal,
  type Menu,
} from "@/app/components/MenuCard";
import { DUR, EASE } from "@/lib/design/tokens";

/* ── Types mirror /api/requests exactly. ─────────────────────────────────── */

type FamilyRequest = {
  id: number;
  title: string;
  note: string | null;
  status: "pending" | "done";
  created_at: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "07:12" if the request is from today, otherwise "12 Jul". */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function FamilyPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [menu, setMenu] = useState<Menu>(EMPTY_MENU);
  const [requests, setRequests] = useState<FamilyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [date] = useState(todayISO);

  useEffect(() => setMounted(true), []);

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token =
        localStorage.getItem("smarthub_token") || localStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        throw new Error("no token");
      }
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      if (res.status === 401) {
        router.replace("/login");
        throw new Error("unauthorized");
      }
      return res;
    },
    [router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mealsRes, mineRes] = await Promise.all([
        authFetch(`/meals?date=${date}`),
        authFetch("/requests/mine"),
      ]);

      if (mealsRes.ok) {
        const mealsData = await mealsRes.json();
        setMenu(menuFromMeals((mealsData.meals || []) as Meal[]));
      }

      const mineData = await mineRes.json();
      if (!mineRes.ok || !mineData.ok) {
        setError(mineData.error || "Could not load your requests.");
        return;
      }
      setRequests(mineData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, date]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Optimistic add with rollback — same contract as the staff panel: the card
     appears instantly, and comes back out (with the form refilled) on failure. */
  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const n = note.trim();
    if (!t || submitting) return;

    const tempId = -Date.now();
    const optimistic: FamilyRequest = {
      id: tempId,
      title: t,
      note: n,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    setSubmitting(true);
    setRequests((current) => [optimistic, ...current]);
    setTitle("");
    setNote("");

    try {
      const res = await authFetch("/requests", {
        method: "POST",
        body: JSON.stringify({ title: t, note: n || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not send. Please try again.");
      }
      setRequests((current) =>
        current.map((r) => (r.id === tempId ? (data.data as FamilyRequest) : r))
      );
      setError(null);
    } catch (err) {
      // Take the ghost card out and put the words back in the form.
      setRequests((current) => current.filter((r) => r.id !== tempId));
      setTitle(t);
      setNote(n);
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    ["smarthub_token", "token", "shh_user_id", "shh_user_name", "shh_role"].forEach(
      (k) => localStorage.removeItem(k)
    );
    router.replace("/login");
  }

  const prettyDate = mounted
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  const enterTransition = reduceMotion
    ? { duration: 0 }
    : { duration: DUR.base, ease: EASE.out };

  return (
    <PageShell
      title="Home"
      subtitle={prettyDate || undefined}
      width="reader"
      action={
        <Button variant="quiet" size="sm" onClick={logout}>
          Sign out
        </Button>
      }
    >
      {/* ── Menu ──────────────────────────────────────────────────────────── */}
      {!loading && hasAnyMeal(menu) && <MenuCard menu={menu} className="mb-h8" />}

      {/* ── Ask Abdullah ──────────────────────────────────────────────────── */}
      <Card className="mb-h8">
        <CardLabel>Request something</CardLabel>
        <form onSubmit={submitRequest} className="mt-h4 flex flex-col gap-h4">
          <Input
            label="What do you need?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. More water in the majlis"
            required
            maxLength={120}
          />
          <Textarea
            label="Details (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
          />
          <Button
            type="submit"
            size="md"
            fullWidth
            loading={submitting}
            disabled={!title.trim()}
            icon={<PaperPlaneTilt size={20} weight="bold" />}
          >
            Send to Abdullah
          </Button>
        </form>
      </Card>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <Card tone="accent" elevation="flat" className="mb-h6">
          <p className="text-h7 font-medium text-hearth-accent">{error}</p>
        </Card>
      )}

      {/* ── Your requests ─────────────────────────────────────────────────── */}
      <Section heading="Your requests">
        {loading && (
          <ul className="flex flex-col gap-h3" aria-hidden>
            {[0, 1].map((i) => (
              <li
                key={i}
                className="h-[76px] animate-pulse rounded-h-lg border border-hearth-line bg-hearth-surface"
              />
            ))}
          </ul>
        )}

        {!loading && requests.length === 0 && (
          <Card tone="sunk" elevation="flat">
            <div className="flex flex-col items-center gap-h2 py-h8 text-center">
              <p className="text-h6 font-medium text-hearth-ink">
                Nothing requested yet
              </p>
              <p className="text-h8 text-hearth-ink-3">
                Whatever you send appears on Abdullah&apos;s screen right away.
              </p>
            </div>
          </Card>
        )}

        {!loading && requests.length > 0 && (
          <ul className="flex flex-col gap-h3">
            <AnimatePresence initial={false}>
              {requests.map((req) => {
                const pending = req.status === "pending";
                return (
                  <motion.li
                    key={req.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={enterTransition}
                  >
                    {pending ? (
                      <Card tone="accent" elevation="flat" as="div">
                        <div className="flex items-start justify-between gap-h4">
                          <p className="text-h6 font-semibold text-hearth-ink">
                            {req.title}
                          </p>
                          <Badge tone="accent">Waiting</Badge>
                        </div>
                        {req.note && (
                          <p className="mt-h2 whitespace-pre-wrap text-h8 text-hearth-ink-2">
                            {req.note}
                          </p>
                        )}
                        <p className="h-tnum mt-h2 text-h9 text-hearth-ink-3">
                          {mounted ? whenLabel(req.created_at) : ""}
                        </p>
                      </Card>
                    ) : (
                      <div className="flex items-center gap-h4 rounded-h-md bg-hearth-surface px-h5 py-h4">
                        <Check
                          size={20}
                          weight="bold"
                          aria-hidden
                          className="shrink-0 text-hearth-done"
                        />
                        <span className="min-w-0 flex-1 truncate text-h7 text-hearth-ink-2">
                          {req.title}
                        </span>
                        <span className="h-tnum shrink-0 text-h9 text-hearth-ink-3">
                          {mounted ? whenLabel(req.created_at) : ""}
                        </span>
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
