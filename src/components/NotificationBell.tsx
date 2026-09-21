"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Notification = Tables<"notifications">;

const ICONS: Record<string, string> = {
  delivery_offer: "📦",
  missed_offer: "⏱️",
  penalty: "🚫",
  rider_penalized: "🚫",
  order_reassigned: "🔁",
  order_unassigned: "↩️",
  rider_status: "🟢",
  support_reply: "💬",
  support_ticket: "🎫",
  order_cancelled: "✖️",
  order_delivered: "✅",
};

export function NotificationBell({ profileId, accent = "amber" }: { profileId: string; accent?: "amber" | "cyan" }) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
  }, [profileId]);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    load();
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `profile_id=eq.${profileId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, load]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    const supabase = createClient();
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    load();
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const accentClass = accent === "amber" ? "bg-amber text-bg" : "bg-cyan text-bg";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        aria-label={t("a11y.notifications")}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised transition-colors hover:border-amber/40"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${accentClass}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            // On a phone the bell is not always at the screen's right edge (the
            // shop header has buttons after it), so a panel hung from the bell
            // ran off the left side. Below `sm` it spans the screen instead.
            className="fixed inset-x-3 top-16 z-[1600] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl shadow-black/50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80"
          >
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold">{t("notif.title")}</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-text-dim">{t("notif.empty")}</p>
              )}
              {notifications.map((n) => (
                <div key={n.id} className="border-b border-border/50 px-4 py-3 last:border-0">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none">{ICONS[n.type] ?? "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-text-dim">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-text-dim/70">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
