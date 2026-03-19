"use client";

import Link from "next/link";
import type { NotificationRow, NotificationType } from "@/lib/services/notifications";

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { dateStyle: "short" });
}

const TYPE_ICONS: Record<NotificationType, string> = {
  urgent: "⚠",
  reminder: "⏰",
  expiration: "📅",
  completed: "✓",
  skipped: "⊘",
  inventory_audit_due: "📋",
  device_health: "📡",
};

export type NotificationPanelProps = {
  notifications: NotificationRow[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose?: () => void;
  /** If true, compact header and link to full page */
  compact?: boolean;
};

export default function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClose,
  compact = false,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-white/95">Notifications</h2>
          {compact && (
            <p className="text-[0.6875rem] text-white/50 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[0.6875rem] font-medium text-white/70 hover:bg-white/5 transition"
            >
              Mark all read
            </button>
          )}
          {compact && (
            <Link
              href="/notifications"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[0.6875rem] font-medium text-blue-300/90 hover:bg-white/5 transition"
            >
              View all
            </Link>
          )}
        </div>
      </div>

      <ul className="flex-1 overflow-auto min-h-0 py-1">
        {notifications.length === 0 ? (
          <li className="px-4 py-8 text-center text-[0.8125rem] text-white/50">
            No notifications yet.
          </li>
        ) : (
          notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => !n.read && onMarkRead(n.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 border-b border-white/[0.04] transition ${!n.read ? "bg-white/[0.03] hover:bg-white/[0.06]" : "hover:bg-white/[0.02]"}`}
              >
                <span className="shrink-0 w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[0.875rem]" aria-hidden>
                  {TYPE_ICONS[n.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[0.8125rem] truncate ${n.read ? "text-white/70" : "font-medium text-white/90"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-[0.6875rem] text-white/55 mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[0.625rem] text-white/40 mt-1.5">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export { timeAgo, TYPE_ICONS };
