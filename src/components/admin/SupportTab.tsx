"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { formatDateTime } from "@/lib/datetime";
import type { Tables } from "@/lib/supabase/types";
import { CornerIcon, LifebuoyIcon } from "./icons";

type Ticket = Tables<"support_tickets"> & {
  profiles?: { name: string } | null;
  orders?: { address: string } | null;
};
type Filter = "open" | "resolved" | "all";

const panel = "surface-raised-soft rounded-2xl ring-1 ring-border/70";

export function SupportTab() {
  const { t, lang } = useLanguage();
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*, profiles(name), orders(address)")
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as Ticket[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setTickets(await fetchTickets());
    setLoading(false);
  }, [fetchTickets]);

  useEffect(() => {
    let live = true;
    fetchTickets().then((list) => {
      if (!live) return;
      setTickets(list);
      setLoading(false);
    });
    const channel = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, fetchTickets]);

  const counts = useMemo(
    () => ({
      open: tickets.filter((x) => x.status === "open").length,
      resolved: tickets.filter((x) => x.status !== "open").length,
      all: tickets.length,
    }),
    [tickets],
  );
  const visible = tickets.filter((x) => filter === "all" || (filter === "open" ? x.status === "open" : x.status !== "open"));

  async function resolve(ticketId: string) {
    setResolving(ticketId);
    setFailedId(null);
    try {
      // This used to ignore the response entirely, so a failed resolve looked
      // exactly like a successful one until the next reload.
      const res = await fetch("/api/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, reply: replies[ticketId] ?? "" }),
      });
      if (!res.ok) throw new Error();
      setReplies((r) => ({ ...r, [ticketId]: "" }));
      await load();
    } catch {
      setFailedId(ticketId);
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/15 text-amber">
            <LifebuoyIcon className="h-4 w-4" />
          </span>
          {t("admin.support.title")}
        </h2>
        <div className="flex w-fit rounded-full bg-surface-raised p-0.5 ring-1 ring-border/70">
          {(
            [
              ["open", t("admin.support.open")],
              ["resolved", t("admin.support.resolved")],
              ["all", t("admin.support.all")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === key ? "text-bg" : "text-text-dim hover:text-text"
              }`}
            >
              {filter === key && (
                <motion.span
                  layoutId="support-filter"
                  className="absolute inset-0 rounded-full bg-amber"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{label}</span>
              <span className={`relative tabular-nums ${filter === key ? "text-bg/70" : "text-text-dim/70"}`}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-12 text-center text-xs text-text-dim">{t("common.loading")}</p>}

      {!loading && visible.length === 0 && (
        <div className={`${panel} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <LifebuoyIcon className="h-6 w-6" />
          </span>
          <p className="text-sm text-text-dim">
            {filter === "open" && tickets.length > 0 ? t("admin.support.allClear") : t("admin.support.empty")}
          </p>
        </div>
      )}

      {visible.map((ticket, i) => {
        const open = ticket.status === "open";
        return (
          <motion.article
            key={ticket.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.04 }}
            className={`${panel} relative overflow-hidden p-5`}
          >
            {/* Open tickets carry an accent edge so they stand out in the "All" view. */}
            <span className={`absolute inset-y-0 left-0 w-1 ${open ? "bg-amber" : "bg-success/60"}`} />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold">{ticket.subject}</p>
                <p className="mt-1 text-[11px] text-text-dim">
                  <span className="text-text">{ticket.profiles?.name ?? t("common.customer")}</span>
                  {ticket.orders?.address ? ` · ${ticket.orders.address}` : ""}
                  {" · "}
                  <span className="tabular-nums">{formatDateTime(ticket.created_at, lang)}</span>
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  open ? "bg-amber/15 text-amber" : "bg-success/15 text-success"
                }`}
              >
                {open ? t("admin.support.open") : t("admin.support.resolved")}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-line rounded-xl bg-bg/50 px-4 py-3 text-sm leading-relaxed ring-1 ring-border/60">
              {ticket.message}
            </p>

            {ticket.admin_reply && (
              <div className="mt-3 flex gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                <CornerIcon className="mt-0.5 h-4 w-4 shrink-0 -scale-x-100" />
                <p className="leading-relaxed">{ticket.admin_reply}</p>
              </div>
            )}

            {open && (
              <div className="mt-3">
                <div className="rounded-xl bg-bg/50 ring-1 ring-border/70 transition-shadow focus-within:ring-amber/60">
                  <textarea
                    rows={2}
                    value={replies[ticket.id] ?? ""}
                    onChange={(e) => setReplies((r) => ({ ...r, [ticket.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) resolve(ticket.id);
                    }}
                    placeholder={t("admin.support.replyPh")}
                    className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-dim"
                  />
                  <div className="flex items-center justify-end gap-3 border-t sm:justify-between border-border/60 px-3 py-2">
                    <span className="hidden text-[10px] text-text-dim sm:inline">{t("admin.support.sendHint")}</span>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => resolve(ticket.id)}
                      disabled={resolving === ticket.id}
                      className="rounded-lg bg-success px-3.5 py-1.5 text-xs font-bold text-bg disabled:opacity-60"
                    >
                      {resolving === ticket.id ? t("admin.support.resolving") : t("admin.support.resolve")}
                    </motion.button>
                  </div>
                </div>
                {failedId === ticket.id && (
                  <p role="alert" className="mt-2 text-xs text-danger">
                    {t("admin.support.err.resolve")}
                  </p>
                )}
              </div>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
