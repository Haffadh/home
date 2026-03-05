"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";

type RealtimeContextValue = {
  connected: boolean;
  /** Manually trigger a refetch event (e.g. after socket was down) */
  notify: (event: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const POLL_INTERVAL_MS = 30_000;
const REALTIME_EVENT = "realtime";

function dispatchRealtime(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: { event, ...payload } }));
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
  
    const wsUrl = API_BASE.replace(/^http/, "ws") + "/realtime";
  
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
  
      ws.onopen = () => {
        setConnected(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
  
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };
  
    } catch (err) {
      console.error("WS connection failed:", err);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [connect]);

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

/** Subscribe to realtime events (e.g. tasks_updated, urgent_updated). Call the callback when event matches. */
export function useRealtimeEvent(event: string, onEvent: () => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.event === event) onEvent();
    };
    window.addEventListener(REALTIME_EVENT, handler);
    return () => window.removeEventListener(REALTIME_EVENT, handler);
  }, [event, onEvent]);
}
