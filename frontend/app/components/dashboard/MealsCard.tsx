"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:3001";

type Meal = {
  id: number;
  date: string;
  meal_type: string;
  description: string;
};

const SECTIONS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
] as const;

type MealsCardProps = { readOnly?: boolean; canEditTasks?: boolean };

export default function MealsCard({ readOnly = false, canEditTasks = true }: MealsCardProps = {}) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/meals`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      setMeals(Array.isArray(data) ? data : []);
    } catch {
      setMeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byType = (type: string) => meals.filter((m) => m.meal_type?.toLowerCase() === type);

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.25s" }}>
      <div className="mb-5">
        <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">Meals</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map(({ key, label }) => {
          const items = byType(key);
          return (
            <div
              key={key}
              className="relative flex-1 rounded-3xl border border-white/[0.06] p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl bg-gradient-to-r from-blue-400/20 to-transparent"
                aria-hidden
              />
              <p className="text-[0.6875rem] font-medium text-white/60 uppercase tracking-wider mb-3">
                {label}
              </p>
              {loading ? (
                <p className="text-[0.8125rem] text-white/40">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-[0.8125rem] text-white/40">No meals logged.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li key={m.id} className="text-[0.8125rem] text-white/80">
                      {m.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
