"use client";

import { useCallback } from "react";
import { useRealtimeTable } from "../../lib/useRealtimeTable";

/**
 * Optional: single subscription point for inventory and notifications realtime.
 * Dispatches "inventory-updated" / "notifications-updated" for components that listen.
 * Currently unused in layout — components subscribe via useRealtimeTable("inventory"|"notifications") directly.
 * Use this provider if you want one channel and event-based refetch instead of per-component subscriptions.
 */
export function SupabaseRealtimeProvider({ children }: { children: React.ReactNode }) {
  const onInventoryChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent("inventory-updated"));
  }, []);
  const onNotificationsChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent("notifications-updated"));
  }, []);

  useRealtimeTable("inventory", onInventoryChange);
  useRealtimeTable("notifications", onNotificationsChange);

  return <>{children}</>;
}
