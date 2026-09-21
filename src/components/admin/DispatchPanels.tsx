"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { StatCounter } from "@/components/StatCounter";
import { useLanguage } from "@/components/LanguageProvider";
import { ROUTE_COLORS } from "@/lib/routeColors";
import { formatDateTime, formatTime } from "@/lib/datetime";
import type { Tables } from "@/lib/supabase/types";
import { BoltIcon, PulseIcon, SearchIcon, TrashIcon, UndoIcon, UsersIcon } from "./icons";

type Order = Tables<"orders">;
type OptimizationRun = Tables<"optimization_runs">;
type Notification = Tables<"notifications">;
export type AdminRider = Tables<"riders"> & { profiles?: { name: string } | null };

/** Stage colours, shared by the pipeline, the status pills and the order dots. */
export const STAGE_TONE: Record<string, { dot: string; pill: string }> = {
  pending: { dot: "bg-text-dim", pill: "bg-text-dim/15 text-text-dim" },
  offered: { dot: "bg-amber", pill: "bg-amber/15 text-amber" },
  assigned: { dot: "bg-cyan", pill: "bg-cyan/15 text-cyan" },
  delivered: { dot: "bg-success", pill: "bg-success/15 text-success" },
  failed: { dot: "bg-danger", pill: "bg-danger/15 text-danger" },
  expired: { dot: "bg-amber", pill: "bg-amber/15 text-amber" },
  cancelled: { dot: "bg-danger", pill: "bg-danger/15 text-danger" },
};

const panel = "surface-raised-soft rounded-2xl ring-1 ring-border/70";

/* ------------------------------------------------------------------------- */
/*  Pipeline                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * The four live counts, read left to right as the path an order takes.
 *
 * These used to be five identical boxes with an emoji each. As boxes they
 * were five unrelated numbers; as one strip with a proportional bar beneath
 * they read as a single flow, and a pile-up at one stage is visible at a
 * glance instead of by comparing digits.
 */
export function PipelineStrip({ orders, ridersOnline }: { orders: Order[]; ridersOnline: number }) {
  const { t } = useLanguage();
  const stages = [
    { key: "pending", label: t("admin.kpi.pending"), color: "var(--text-dim)" },
    { key: "offered", label: t("admin.kpi.awaitingAccept"), color: "var(--amber)" },
    { key: "assigned", label: t("admin.kpi.inProgress"), color: "var(--cyan)" },
    { key: "delivered", label: t("admin.kpi.delivered"), color: "var(--success)" },
  ].map((s) => ({ ...s, value: orders.filter((o) => o.status === s.key).length }));
  const flowTotal = stages.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="mt-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-dim">{t("admin.pipeline")}</p>
        <p className="text-[11px] text-text-dim">{t("admin.pipelineTotal", { count: orders.length })}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        {stages.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={`min-w-0 ${i > 0 ? "sm:border-l sm:border-border/60 sm:pl-5" : ""}`}
          >
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-dim">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </div>
            <StatCounter
              value={s.value}
              decimals={0}
              className="mt-1.5 block font-display text-4xl font-semibold tabular-nums leading-none tracking-tight"
            />
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="col-span-2 flex items-center gap-3 rounded-2xl bg-success/10 px-4 py-3 ring-1 ring-success/25 sm:col-span-1 sm:ml-2"
        >
          <span className="relative flex h-2.5 w-2.5">
            {ridersOnline > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ridersOnline > 0 ? "bg-success" : "bg-text-dim"}`} />
          </span>
          <div>
            <StatCounter value={ridersOnline} decimals={0} className="font-display text-2xl font-semibold leading-none tabular-nums" />
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">{t("admin.ridersOnline")}</p>
          </div>
        </motion.div>
      </div>

      <div className="mt-5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-border/40">
        {stages.map((s) => (
          <motion.span
            key={s.key}
            className="h-full rounded-full"
            style={{ backgroundColor: s.color }}
            initial={{ width: 0 }}
            animate={{ width: flowTotal ? `${(s.value / flowTotal) * 100}%` : "0%" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Routing                                                                  */
/* ------------------------------------------------------------------------- */

export function RoutingCard({
  lastRun,
  optimizing,
  canOptimize,
  onOptimize,
}: {
  lastRun: OptimizationRun | null;
  optimizing: boolean;
  canOptimize: boolean;
  onOptimize: () => void;
}) {
  const { t, lang } = useLanguage();
  const before = lastRun?.total_distance_before ?? 0;
  const after = lastRun?.total_distance_after ?? 0;
  const saved = before > 0 ? ((before - after) / before) * 100 : 0;

  return (
    <section className={`${panel} relative overflow-hidden p-5`}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="text-cyan">
            <PulseIcon />
          </span>
          {t("admin.routing")}
        </h2>
        {lastRun && <span className="text-[11px] text-text-dim">{formatTime(lastRun.run_at, lang)}</span>}
      </div>

      {lastRun ? (
        <div className="relative mt-4">
          <div className="flex items-baseline gap-2.5">
            <StatCounter value={after} suffix=" km" className="font-display text-3xl font-semibold tabular-nums text-cyan" />
            {saved > 0 && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                −{saved.toFixed(0)}%
              </span>
            )}
          </div>
          {/* Two bars on one scale: the length of the naive plan against the optimised one. */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/40">
                <motion.div
                  className="h-full rounded-full bg-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: before ? `${(after / before) * 100}%` : "0%" }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="w-16 text-right text-[11px] tabular-nums text-text-dim">{after.toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-text-dim/30" />
              <span className="w-16 text-right text-[11px] tabular-nums text-text-dim line-through">{before.toFixed(1)} km</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-text-dim">
            {saved > 0 ? t("admin.shorterThanBaseline", { pct: saved.toFixed(0) }) : t("admin.baseline")}
          </p>
        </div>
      ) : (
        <p className="relative mt-3 text-xs leading-relaxed text-text-dim">{t("admin.noRunYet")}</p>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onOptimize}
        disabled={optimizing || !canOptimize}
        className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 py-2.5 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {optimizing ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
        ) : (
          <BoltIcon className="h-4 w-4" />
        )}
        {optimizing ? t("admin.optimizing") : t("admin.forceOptimize")}
      </motion.button>
      <p className="relative mt-2 text-[11px] leading-relaxed text-text-dim">{t("admin.autoDispatchNote")}</p>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/*  Riders                                                                   */
/* ------------------------------------------------------------------------- */

export function RidersPanel({
  riders,
  now,
  focusRiderId,
  onFocus,
}: {
  riders: AdminRider[];
  now: number;
  focusRiderId: string | null;
  onFocus: (id: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <section className={`${panel} p-5`}>
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <span className="text-success">
          <UsersIcon />
        </span>
        {t("admin.activeRidersHeading")}
        <span className="ml-auto rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-medium tabular-nums text-text-dim">
          {riders.length}
        </span>
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-text-dim">
        {t("admin.ridersHint1")}{" "}
        <a href="/rider/signup" target="_blank" rel="noreferrer" className="text-cyan underline-offset-2 hover:underline">
          {t("admin.riderPortalLink")}
        </a>{" "}
        {t("admin.ridersHint2")}
      </p>

      <div className="mt-4 space-y-1">
        {riders.map((rider, idx) => {
          const isLive =
            !!rider.location_updated_at && now - new Date(rider.location_updated_at).getTime() < 2 * 60 * 1000;
          const isSuspended = !!rider.suspended_until && new Date(rider.suspended_until).getTime() > now;
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const focused = focusRiderId === rider.id;
          return (
            <motion.button
              key={rider.id}
              layout
              whileHover={{ x: 2 }}
              onClick={() => onFocus(rider.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                focused ? "bg-cyan/10 ring-1 ring-cyan/40" : "hover:bg-surface-raised"
              }`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-bg ring-2 ring-offset-2 ring-offset-surface"
                style={{ backgroundColor: color, ["--tw-ring-color" as string]: `${color}66` }}
              >
                {(rider.profiles?.name ?? "R").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{rider.profiles?.name ?? t("common.rider")}</span>
                <span className="block text-[11px] text-text-dim">
                  {isSuspended ? (
                    <span className="text-danger">{t("admin.suspended")}</span>
                  ) : (
                    t("admin.users.cap", { n: rider.capacity ?? "—" })
                  )}
                </span>
              </span>
              <span
                title={isLive ? t("admin.tip.gpsLive") : t("admin.tip.gpsStale")}
                className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isLive ? "text-success" : "text-text-dim"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-success" : "bg-text-dim/60"}`} />
                {isLive ? t("admin.liveGps") : t("admin.noGps")}
              </span>
            </motion.button>
          );
        })}
        {riders.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-text-dim">
            {t("admin.noRidersOnline")}
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/*  Activity                                                                 */
/* ------------------------------------------------------------------------- */

export function ActivityTimeline({ activity }: { activity: Notification[] }) {
  const { t, lang } = useLanguage();
  return (
    <section className={`${panel} p-5`}>
      <h2 className="font-display text-sm font-semibold">{t("admin.activity")}</h2>
      {activity.length === 0 ? (
        <p className="mt-3 text-xs text-text-dim">{t("admin.noActivity")}</p>
      ) : (
        <ol className="relative mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
          {/* The spine the events hang from. */}
          <span className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-amber/50 via-border to-transparent" />
          {activity.map((n, i) => (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 6) * 0.04 }}
              className="relative pl-6"
            >
              <span
                className={`absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-surface ${
                  i === 0 ? "bg-amber" : "bg-border"
                }`}
              />
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-semibold">{n.title}</p>
                <span className="shrink-0 text-[10px] tabular-nums text-text-dim">{formatTime(n.created_at, lang)}</span>
              </div>
              {n.body && <p className="mt-0.5 text-xs leading-relaxed text-text-dim">{n.body}</p>}
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/*  Orders                                                                   */
/* ------------------------------------------------------------------------- */

type Filter = "all" | "pending" | "offered" | "assigned" | "delivered" | "closed" | "disputed";
const CLOSED = new Set(["failed", "expired", "cancelled"]);

function matches(order: Order, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "closed") return CLOSED.has(order.status);
  if (filter === "disputed") return order.dispute_status === "open";
  return order.status === filter;
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        STAGE_TONE[status]?.pill ?? "bg-surface-raised text-text-dim"
      }`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

export function OrdersBoard({
  orders,
  riderNames,
  focusOrderId,
  confirmDeleteId,
  deletingId,
  reassigningId,
  onFocus,
  onDelete,
  onCancelConfirm,
  onReassign,
}: {
  orders: Order[];
  riderNames: Map<string, string>;
  focusOrderId: string | null;
  confirmDeleteId: string | null;
  deletingId: string | null;
  reassigningId: string | null;
  onFocus: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelConfirm: (id: string) => void;
  onReassign: (id: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, pending: 0, offered: 0, assigned: 0, delivered: 0, closed: 0, disputed: 0 };
    for (const o of orders) {
      (Object.keys(c) as Filter[]).forEach((f) => {
        if (matches(o, f)) c[f] += 1;
      });
    }
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => matches(o, filter) && (!q || o.address.toLowerCase().includes(q)));
  }, [orders, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("admin.filter.all") },
    { key: "pending", label: t("admin.kpi.pending") },
    { key: "offered", label: t("admin.kpi.awaitingAccept") },
    { key: "assigned", label: t("admin.kpi.inProgress") },
    { key: "delivered", label: t("admin.kpi.delivered") },
    { key: "closed", label: t("admin.filter.closed") },
    ...(counts.disputed > 0 ? [{ key: "disputed" as Filter, label: t("admin.disputed") }] : []),
  ];

  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-sm font-semibold">
          {t("admin.orders")} <span className="font-normal tabular-nums text-text-dim">· {orders.length}</span>
        </h2>
        <label className="flex items-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-text-dim ring-1 ring-border/70 focus-within:ring-amber/60 sm:w-64">
          <SearchIcon className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.searchOrders")}
            className="w-full bg-transparent text-xs text-text outline-none placeholder:text-text-dim"
          />
        </label>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-5 pt-4 pb-1 [scrollbar-width:none]">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                active ? "text-bg" : "text-text-dim hover:text-text"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="orders-filter"
                  className={`absolute inset-0 rounded-full ${f.key === "disputed" ? "bg-danger" : "bg-amber"}`}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{f.label}</span>
              <span className={`relative tabular-nums ${active ? "text-bg/70" : "text-text-dim/70"}`}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      <ul className="max-h-[560px] divide-y divide-border/50 overflow-y-auto px-2 pb-2 pt-2">
        {visible.map((order) => {
          const focused = focusOrderId === order.id;
          const confirming = confirmDeleteId === order.id;
          const rider = order.assigned_rider_id ? riderNames.get(order.assigned_rider_id) : null;
          const movable = order.status === "assigned" || order.status === "offered";
          return (
            <li
              key={order.id}
              className={`group flex items-center gap-2 rounded-xl px-2 transition-colors ${
                focused ? "bg-cyan/10" : "hover:bg-surface-raised/70"
              }`}
            >
              <button
                onClick={() => onFocus(order.id)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-1 text-left"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${STAGE_TONE[order.status]?.dot ?? "bg-border"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{order.address}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-dim">
                    <span className="tabular-nums">{formatDateTime(order.created_at, lang)}</span>
                    <span aria-hidden>·</span>
                    <span className={rider ? "text-text" : ""}>
                      {rider ?? (order.assigned_rider_id ? t("common.rider") : t("admin.unassigned"))}
                    </span>
                    {order.sequence_in_route != null && order.status === "assigned" && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{t("admin.stopN", { n: order.sequence_in_route })}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {order.dispute_status === "open" && (
                    <span
                      title={t("admin.tip.disputed")}
                      className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase text-danger"
                    >
                      {t("admin.disputed")}
                    </span>
                  )}
                  <StatusPill status={order.status} />
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                {movable && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onReassign(order.id)}
                    disabled={reassigningId === order.id}
                    title={t("admin.tip.reassign")}
                    aria-label={t("admin.tip.reassign")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-amber/15 hover:text-amber disabled:opacity-50"
                  >
                    {reassigningId === order.id ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent" />
                    ) : (
                      <UndoIcon className="h-4 w-4" />
                    )}
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => onDelete(order.id)}
                  onBlur={() => onCancelConfirm(order.id)}
                  disabled={deletingId === order.id}
                  title={confirming ? t("admin.tip.confirmDelete") : t("admin.tip.delete")}
                  aria-label={confirming ? t("admin.tip.confirmDelete") : t("admin.tip.delete")}
                  className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold transition-all ${
                    confirming
                      ? "bg-danger px-2.5 text-white"
                      : "w-8 text-text-dim hover:bg-danger/15 hover:text-danger"
                  }`}
                >
                  {deletingId === order.id ? "…" : confirming ? t("admin.confirmQ") : <TrashIcon className="h-4 w-4" />}
                </motion.button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="py-10 text-center text-xs text-text-dim">
            {orders.length === 0 ? t("admin.noOrders") : t("admin.noMatch")}
          </li>
        )}
      </ul>
    </section>
  );
}
