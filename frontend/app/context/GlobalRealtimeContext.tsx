"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

export type RealtimeTableCallback = () => void;

type GlobalRealtimeContextValue = {
  subscribe: (table: string, callback: RealtimeTableCallback) => void;
  unsubscribe: (table: string, callback: RealtimeTableCallback) => void;
};

const GlobalRealtimeContext = createContext<GlobalRealtimeContextValue | null>(null);

export function GlobalRealtimeProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef<Map<string, Set<RealtimeTableCallback>>>(new Map());
  const channelsRef = useRef<Map<string, unknown>>(new Map());

  const subscribe = useCallback((table: string, callback: RealtimeTableCallback) => {
    const listeners = listenersRef.current;
    if (!listeners.has(table)) listeners.set(table, new Set());
    listeners.get(table)!.add(callback);

    const channels = channelsRef.current;
    if (channels.has(table)) return;

    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`global:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          const cbs = listenersRef.current.get(table);
          if (cbs) cbs.forEach((cb) => cb());
        }
      )
      .subscribe();

    channels.set(table, channel);
  }, []);

  const unsubscribe = useCallback((table: string, callback: RealtimeTableCallback) => {
    const listeners = listenersRef.current;
    const cbs = listeners.get(table);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size > 0) return;

    listeners.delete(table);

    const channels = channelsRef.current;
    const channel = channels.get(table);
    const client = getSupabaseClient();
    if (channel && client) {
      client.removeChannel(channel);
      channels.delete(table);
    }
  }, []);

  useEffect(() => {
    return () => {
      const channels = channelsRef.current;
      const client = getSupabaseClient();
      channels.forEach((ch) => {
        if (client) client.removeChannel(ch);
      });
      channels.clear();
      listenersRef.current.clear();
    };
  }, []);

  return (
    <GlobalRealtimeContext.Provider value={{ subscribe, unsubscribe }}>
      {children}
    </GlobalRealtimeContext.Provider>
  );
}

export function useGlobalRealtime() {
  return useContext(GlobalRealtimeContext);
}
