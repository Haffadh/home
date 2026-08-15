"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import { Badge, Button, Card, CardLabel, Input, Select } from "@/app/components/ui";
import { DISH_GROUPS } from "@/lib/dishes";
import { DUR, EASE } from "@/lib/design/tokens";
import { useInstantMotion } from "@/lib/design/motion";
import { MEAL_ORDER, MEAL_LABEL, type Meal, type MealType } from "./MenuCard";

/* ── Setting today's menu ────────────────────────────────────────────────────
   Lifted out of the admin panel so the family panel can use it too. Deciding
   what is for lunch is a family act, not an administrative one, and the family
   panel was the only surface most of the household ever sees — there is no
   navigation between panels, so "set the menu" was effectively unreachable
   without signing out and back in as Admin.                                  */

type Draft = Record<MealType, string>;
const EMPTY: Draft = { breakfast: "", lunch: "", dinner: "" };

export function MenuEditor({
  date,
  authFetch,
  onSaved,
  className,
}: {
  date: string;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Called after a successful save so the caller can refresh its own view. */
  onSaved?: () => void;
  className?: string;
}) {
  const instant = useInstantMotion();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Synchronous guard — a state flag flips only after a commit, leaving a
     same-frame window where a double-tap saves twice. */
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/meals?date=${date}`);
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      const next = { ...EMPTY };
      for (const m of (data.meals || []) as Meal[]) {
        if (m.meal_type in next) next[m.meal_type as MealType] = m.name;
      }
      setDraft(next);
    } catch {
      /* The editor still works empty; the save is what matters. */
    }
  }, [authFetch, date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const filled = MEAL_ORDER.filter((slot) => draft[slot].trim() !== "");
      if (filled.length === 0) {
        setError("Nothing to save yet.");
        return;
      }
      const results = await Promise.all(
        filled.map((slot) =>
          authFetch("/meals", {
            method: "POST",
            body: JSON.stringify({
              date,
              meal_type: slot,
              name: draft[slot].trim(),
            }),
          })
        )
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        setError(data.error || "Could not save the menu.");
        return;
      }
      setSavedAt(Date.now());
      setTimeout(() => {
        setSavedAt((t) => (t && Date.now() - t >= 2000 ? null : t));
      }, 2000);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the menu.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Card className={className}>
      <CardLabel>Today&apos;s menu</CardLabel>
      <div className="mt-h4 flex flex-col gap-h4">
        {MEAL_ORDER.map((slot) => (
          <div key={slot} className="grid items-end gap-h3 md:grid-cols-[1fr_16rem]">
            <Input
              label={MEAL_LABEL[slot]}
              value={draft[slot]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [slot]: e.target.value }))
              }
              placeholder={`What's for ${slot}?`}
            />
            <Select
              label={`Pick a dish for ${slot}`}
              hideLabel
              value=""
              onChange={(e) => {
                const dish = e.target.value;
                if (!dish) return;
                setDraft((d) => ({ ...d, [slot]: dish }));
              }}
            >
              <option value="">Pick a dish…</option>
              {DISH_GROUPS.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.dishes.map((dish) => (
                    <option key={dish} value={dish}>
                      {dish}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-h5 flex items-center gap-h4">
        <Button type="button" onClick={save} loading={saving}>
          Save menu
        </Button>
        <AnimatePresence initial={false}>
          {savedAt && (
            <motion.span
              key="saved"
              initial={instant ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: { duration: instant ? 0 : DUR.fast },
              }}
              transition={
                instant ? { duration: 0 } : { duration: DUR.fast, ease: EASE.out }
              }
            >
              <Badge tone="done" icon={<Check size={14} weight="bold" />}>
                Saved
              </Badge>
            </motion.span>
          )}
        </AnimatePresence>
        {error && (
          <p className="text-h8 font-medium text-hearth-accent">{error}</p>
        )}
      </div>
    </Card>
  );
}
