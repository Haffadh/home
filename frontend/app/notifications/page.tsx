"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { getSupabaseClient } from "@/lib/supabaseClient";
import * as notificationsService from "@/lib/services/notifications";
import type { NotificationRow } from "@/lib/services/notifications";
import { TYPE_ICONS, timeAgo } from "../components/notifications/NotificationPanel";

export default function NotificationsPage() {
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getSupabaseClient()) return;
    setLoading(true);
    try {
      const data = await notificationsService.fetchNotifications();
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtimeTable("notifications", load);

  async function markRead(id: string) {
    if (!getSupabaseClient()) return;
    try {
      await notificationsService.markNotificationRead(id);
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    if (!getSupabaseClient()) return;
    try {
      await notificationsService.markAllNotificationsRead();
      setList((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      load();
    }
  }

  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <div className="max-w-screen-md mx-auto px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white/95 tracking-tight">Notifications</h1>
          <p className="text-[0.8125rem] text-white/55 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2 text-[0.8125rem] font-medium text-white/80 hover:bg-[#0f172a]/80 transition"
            >
              Mark all read
            </button>
          )}
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2 text-[0.8125rem] font-medium text-white/80 hover:bg-[#0f172a]/80 transition"
          >
            Back
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-[0.8125rem] text-white/50">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0f172a]/50 p-8 text-center text-[0.8125rem] text-white/50">
          No notifications yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border border-white/[0.06] p-4 transition ${
                n.read ? "bg-[#0f172a]/30" : "bg-[#0f172a]/50"
              }`}
            >
              <button
                type="button"
                onClick={() => !n.read && markRead(n.id)}
                className="w-full text-left flex gap-3"
              >
                <span className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm" aria-hidden>
                  {TYPE_ICONS[n.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={`text-[0.9375rem] ${n.read ? "text-white/70" : "font-medium text-white/95"}`}>{n.title}</h3>
                  {n.body && <p className="text-[0.8125rem] text-white/60 mt-0.5">{n.body}</p>}
                  <p className="text-[0.6875rem] text-white/45 mt-2">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && (
                  <span className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[0.6875rem] font-medium text-white/60">
                    Mark read
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
