"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RealtimeContextValue = {
  connected: boolean;
  /** Manually trigger a refetch event (e.g. after a mutation) */
  notify: (event: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const POLL_INTERVAL_MS = 8_000; // 8-second fallback polling
const REALTIME_EVENT = "realtime";

function dispatchRealtime(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: { event, ...payload } }));
}

/**
 * Hybrid realtime provider:
 * 1. Supabase Realtime (instant) — listens for DB changes on key tables
 * 2. Polling fallback (8s) — ensures sync if Supabase Realtime is unavailable
 *
 * After any local mutation, components should call notify("tasks_updated") etc.
 * to trigger immediate refresh on the same device.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]> | null>(null);

  useEffect(() => {
    // ── Supabase Realtime (instant cross-device sync) ──────────────
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const channel = supabase
          .channel("db-changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
            dispatchRealtime("tasks_updated");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "urgent_tasks" }, () => {
            dispatchRealtime("urgent_updated");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, () => {
            dispatchRealtime("meals_updated");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "scenes" }, () => {
            dispatchRealtime("scenes_updated");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "groceries" }, () => {
            dispatchRealtime("groceries_updated");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
            dispatchRealtime("inventory_updated");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "daily_task_instances" }, () => {
            dispatchRealtime("tasks_updated");
          })
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
          });

        channelRef.current = channel;
      } catch {
        // Supabase not available — rely on polling
      }
    }

    // ── Polling fallback (always active, catches anything Realtime misses) ──
    setConnected(true);
    pollRef.current = setInterval(() => {
      dispatchRealtime("tasks_updated");
      dispatchRealtime("urgent_updated");
      dispatchRealtime("meals_updated");
      dispatchRealtime("groceries_updated");
      dispatchRealtime("devices_updated");
      dispatchRealtime("inventory_updated");
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (channelRef.current) {
        const supabase = getSupabaseClient();
        if (supabase) supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const notify = useCallback((event: string) => {
    dispatchRealtime(event, {});
  }, []);

  return (
    <RealtimeContext.Provider value={{ connected, notify }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

/** Subscribe to realtime events. Uses a ref for the callback so subscription is stable. */
export function useRealtimeEvent(event: string, onEvent: () => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.event === event) onEventRef.current();
    };
    window.addEventListener(REALTIME_EVENT, handler);
    return () => window.removeEventListener(REALTIME_EVENT, handler);
  }, [event]);
}
