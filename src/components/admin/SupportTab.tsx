"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Ticket = Tables<"support_tickets"> & {
  profiles?: { name: string } | null;
  orders?: { address: string } | null;
};

export function SupportTab() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*, profiles(name), orders(address)")
      .order("created_at", { ascending: false });
    setTickets((data ?? []) as unknown as Ticket[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function resolve(ticketId: string) {
    setResolving(ticketId);
    try {
      await fetch("/api/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, reply: replies[ticketId] ?? "" }),
      });
      setReplies((r) => ({ ...r, [ticketId]: "" }));
      await load();
    } finally {
      setResolving(null);
    }
  }

  if (loading) return <p className="p-6 text-xs text-text-dim">{t("common.loading")}</p>;

  return (
    <div className="space-y-3 p-6">
      <h2 className="font-display text-sm font-semibold">{t("admin.support.title")}</h2>

      {tickets.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface py-10 text-center text-xs text-text-dim">
          {t("admin.support.empty")}
        </p>
      )}

      {tickets.map((ticket) => {
        const open = ticket.status === "open";
        return (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border bg-surface p-4 ${
              open ? "border-amber/40" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{ticket.subject}</p>
                <p className="text-[11px] text-text-dim">
                  {ticket.profiles?.name ?? t("common.customer")}
                  {ticket.orders?.address ? ` · ${ticket.orders.address}` : ""}
                  {" · "}
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  open ? "bg-amber/20 text-amber" : "bg-success/20 text-success"
                }`}
              >
                {open ? t("admin.support.open") : t("admin.support.resolved")}
              </span>
            </div>

            <p className="mt-2 rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-dim">
              {ticket.message}
            </p>

            {ticket.admin_reply && (
              <p className="mt-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                ↳ {ticket.admin_reply}
              </p>
            )}

            {open && (
              <div className="mt-2.5 flex gap-2">
                <input
                  value={replies[ticket.id] ?? ""}
                  onChange={(e) => setReplies((r) => ({ ...r, [ticket.id]: e.target.value }))}
                  placeholder={t("admin.support.replyPh")}
                  className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs outline-none focus:border-amber"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => resolve(ticket.id)}
                  disabled={resolving === ticket.id}
                  className="shrink-0 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-bg disabled:opacity-60"
                >
                  {resolving === ticket.id ? t("admin.support.resolving") : t("admin.support.resolve")}
                </motion.button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
