"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type RealtimeContextValue = {
  connected: boolean;
  /** Manually trigger a refetch event (e.g. after a mutation) */
  notify: (event: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const POLL_INTERVAL_MS = 30_000;
const REALTIME_EVENT = "realtime";

function dispatchRealtime(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: { event, ...payload } }));
}

/**
 * Polling-based realtime provider.
 * WebSocket was removed because Vercel serverless doesn't support persistent WS connections.
 * Dispatches periodic refresh events so components stay in sync.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setConnected(true);

    // Poll: dispatch generic refresh events periodically
    pollRef.current = setInterval(() => {
      dispatchRealtime("tasks_updated");
      dispatchRealtime("urgent_updated");
      dispatchRealtime("groceries_updated");
      dispatchRealtime("devices_updated");
      dispatchRealtime("inventory_updated");
      dispatchRealtime("meals_updated");
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
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

/** Subscribe to realtime events (e.g. tasks_updated, urgent_updated). Uses a ref for the callback so subscription is stable (only event name in deps). */
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
