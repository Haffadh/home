"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { getSupabaseClient } from "@/lib/supabaseClient";
import * as notificationsService from "@/lib/services/notifications";
import type { NotificationRow } from "@/lib/services/notifications";
import { TYPE_ICONS, timeAgo } from "../components/notifications/NotificationPanel";
import {
  pageEntry,
  staggerContainer,
  listItem,
  SPRING_TAP,
  EASE_OUT_SOFT,
} from "@/lib/motion";

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

  useEffect(() => {
    load();
  }, [load]);

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
    <motion.div
      initial="hidden"
      animate="show"
      className="max-w-screen-md mx-auto px-4 py-6 md:py-10"
    >
      <motion.div
        variants={pageEntry}
        className="flex flex-wrap items-center justify-between gap-4 mb-6"
      >
        <div>
          <motion.h1
            className="text-xl font-semibold text-white/95 tracking-tight"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_SOFT }}
          >
            Notifications
          </motion.h1>
          <motion.p
            key={unreadCount}
            className="text-[0.8125rem] text-white/55 mt-0.5"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_SOFT }}
          >
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </motion.p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.button
                key="mark-all"
                type="button"
                onClick={markAllRead}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_TAP}
                className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2 text-[0.8125rem] font-medium text-white/80 hover:bg-[#0f172a]/80 hover:border-white/20 transition-colors"
              >
                Mark all read
              </motion.button>
            )}
          </AnimatePresence>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_TAP}
          >
            <Link
              href="/"
              className="inline-block rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2 text-[0.8125rem] font-medium text-white/80 hover:bg-[#0f172a]/80 hover:border-white/20 transition-colors"
            >
              Back
            </Link>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[0.8125rem] text-white/50"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60"
            />
            Loading…
          </motion.div>
        ) : list.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_SOFT }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a]/60 to-[#0f172a]/30 p-10 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT_SOFT }}
              className="text-4xl mb-3"
              aria-hidden
            >
              🔕
            </motion.div>
            <p className="text-[0.875rem] text-white/70 font-medium">No notifications yet</p>
            <p className="text-[0.75rem] text-white/40 mt-1">You&apos;re all caught up.</p>
          </motion.div>
        ) : (
          <motion.ul
            key="list"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <AnimatePresence initial={false}>
              {list.map((n) => (
                <motion.li
                  key={n.id}
                  variants={listItem}
                  layout
                  exit={{ opacity: 0, x: -20 }}
                  className={`rounded-2xl border p-4 transition-colors ${
                    n.read
                      ? "bg-[#0f172a]/30 border-white/[0.04]"
                      : "bg-[#0f172a]/50 border-white/[0.08]"
                  }`}
                >
                  <motion.button
                    type="button"
                    onClick={() => !n.read && markRead(n.id)}
                    whileTap={!n.read ? { scale: 0.99 } : undefined}
                    transition={SPRING_TAP}
                    className="w-full text-left flex gap-3"
                  >
                    <motion.span
                      className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm"
                      aria-hidden
                      whileHover={!n.read ? { scale: 1.05, rotate: 3 } : undefined}
                    >
                      {TYPE_ICONS[n.type]}
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-[0.9375rem] ${n.read ? "text-white/70" : "font-medium text-white/95"}`}>
                        {n.title}
                      </h3>
                      {n.body && <p className="text-[0.8125rem] text-white/60 mt-0.5">{n.body}</p>}
                      <p className="text-[0.6875rem] text-white/45 mt-2">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <motion.span
                        className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[0.6875rem] font-medium text-amber-200/90"
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        New
                      </motion.span>
                    )}
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
