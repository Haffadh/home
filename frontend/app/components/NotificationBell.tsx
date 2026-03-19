"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { getSupabaseClient } from "@/lib/supabaseClient";
import * as notificationsService from "@/lib/services/notifications";
import type { NotificationRow } from "@/lib/services/notifications";
import NotificationPanel from "./notifications/NotificationPanel";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!getSupabaseClient()) return;
    try {
      const all = await notificationsService.fetchNotifications();
      setNotifications(all);
    } catch {
      setNotifications([]);
    }
  }, []);

  useRealtimeTable("notifications", load);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!document.getElementById("notification-bell-root")?.contains(target)) setOpen(false);
    };
    document.addEventListener("click", onOutside);
    return () => document.removeEventListener("click", onOutside);
  }, [open]);

  async function handleMarkRead(id: string) {
    if (!getSupabaseClient()) return;
    try {
      await notificationsService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      load();
    }
  }

  async function handleMarkAllRead() {
    if (!getSupabaseClient()) return;
    try {
      await notificationsService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      load();
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const panelList = notifications.slice(0, 12);

  if (!getSupabaseClient()) return null;

  return (
    <div id="notification-bell-root" className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="relative w-10 h-10 rounded-2xl flex items-center justify-center bg-[#0f172a]/70 hover:bg-[#0f172a]/80 border border-white/10 transition"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <span className="text-lg" aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-500 text-[0.6875rem] font-bold text-white flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[70vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a]/95 backdrop-blur-xl shadow-xl z-50 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <NotificationPanel
            notifications={panelList}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onClose={() => setOpen(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}
