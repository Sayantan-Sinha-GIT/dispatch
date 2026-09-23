"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type Ticket = Pick<Tables<"support_tickets">, "id" | "subject" | "status" | "admin_reply" | "created_at">;

/** Lets a customer raise a support request against a specific order. */
export function SupportSheet({ orderId }: { orderId?: string | null }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Support answers used to go only into a notification, and the customer
  // screens had no notification bell - so a reply was written and never
  // seen. The order now shows its own requests, and updates as they're
  // answered.
  const fetchTickets = useCallback(async () => {
    if (!orderId) return [] as Ticket[];
    const { data } = await createClient()
      .from("support_tickets")
      .select("id, subject, status, admin_reply, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    return (data ?? []) as Ticket[];
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    let live = true;
    const supabase = createClient();
    fetchTickets().then((list) => live && setTickets(list));
    const channel = supabase
      .channel(`order-support-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `order_id=eq.${orderId}` },
        () => fetchTickets().then((list) => live && setTickets(list)),
      )
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchTickets]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, orderId: orderId ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);
      setSent(true);
      setSubject("");
      setMessage("");
      setTickets(await fetchTickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.err.generic"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {tickets.length > 0 && (
        <section className="mb-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">{t("tracking.yourRequests")}</p>
          {tickets.map((tk) => {
            const open = tk.status === "open";
            return (
              <div key={tk.id} className="rounded-2xl card-soft border border-transparent bg-surface/70 p-3.5 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">{tk.subject}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      open ? "bg-brand/15 text-brand" : "bg-success/15 text-success"
                    }`}
                  >
                    {open ? t("admin.support.open") : t("admin.support.resolved")}
                  </span>
                </div>
                {open ? (
                  <p className="mt-1.5 text-xs text-text-dim">{t("tracking.awaitingReply")}</p>
                ) : tk.admin_reply ? (
                  <div className="mt-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-text">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                      {t("tracking.supportReplied")}
                    </p>
                    {tk.admin_reply}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-success">{t("tracking.resolvedNoReply")}</p>
                )}
              </div>
            );
          })}
        </section>
      )}

      <button
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
        className="w-full rounded-2xl card-soft border border-transparent bg-surface/60 px-4 py-3 text-sm text-text-dim backdrop-blur transition-colors hover:border-zest/40 hover:text-text"
      >
        💬 {t("tracking.needHelp")}
      </button>

      <AnimatePresence>
        {/* z-[1500]: above Leaflet's map controls, which sit at z-index 1000. */}
        {open && (
          <motion.div
            key="support-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl card-soft border border-transparent bg-surface p-5 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{t("tracking.supportTitle")}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-1 text-sm text-text-dim hover:text-text"
                >
                  ✕
                </button>
              </div>

              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border border-success/40 bg-success/10 p-5 text-center"
                >
                  <p className="mb-1 text-3xl">✅</p>
                  <p className="text-sm text-success">{t("tracking.supportSent")}</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-3 rounded-lg bg-surface-raised px-4 py-2 text-xs text-text-dim"
                  >
                    {t("common.close")}
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  {error && (
                    <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
                  )}
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("tracking.supportSubject")}
                    className="w-full rounded-xl border border-border/50 bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-zest"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("tracking.supportMessage")}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-border/50 bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-zest"
                  />
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={sending || !subject.trim() || !message.trim()}
                    className="w-full rounded-full bg-lime py-3 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    {sending ? t("tracking.supportSending") : t("tracking.supportSend")}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
