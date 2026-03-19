"use client";

import { useEffect, useRef } from "react";
import { useGlobalRealtime } from "@/app/context/GlobalRealtimeContext";

export type RealtimeTableCallback = () => void;

/**
 * Realtime: register with GlobalRealtimeContext so only ONE Supabase channel exists per table.
 * Subscribes to INSERT/UPDATE/DELETE on the given table and calls onChange so the consumer can refetch.
 * Calls onChange once on mount so the component loads initial data without a separate useEffect.
 * Cleanup on unmount: unregisters the callback; channel is removed when last subscriber unsubscribes.
 */
export function useRealtimeTable(table: string, onChange: RealtimeTableCallback): void {
  const ctx = useGlobalRealtime();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current();
  }, []);

  useEffect(() => {
    if (!ctx) return;

    const wrapper = () => {
      onChangeRef.current();
    };

    ctx.subscribe(table, wrapper);
    return () => {
      ctx.unsubscribe(table, wrapper);
    };
  }, [ctx, table]);
}
