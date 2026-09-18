"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { StatCounter } from "@/components/StatCounter";
import { RouteMapClient } from "@/components/RouteMapClient";
import { NotificationBell } from "@/components/NotificationBell";
import { useSweepPolling } from "@/lib/useSweepPolling";
import { ROUTE_COLORS } from "@/lib/routeColors";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AmbientBackground } from "@/components/AmbientBackground";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;
type Rider = Tables<"riders"> & { profiles?: { name: string } | null };
type OptimizationRun = Tables<"optimization_runs">;
type Notification = Tables<"notifications">;

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [lastRun, setLastRun] = useState<OptimizationRun | null>(null);
  const [activity, setActivity] = useState<Notification[]>([]);
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [focusRiderId, setFocusRiderId] = useState<string | null>(null);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [profileId, setProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<"dispatch" | "products" | "users">("dispatch");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const parsingRef = useRef(false);

  useSweepPolling();

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setProfileId(user.id);

    const [ordersRes, ridersRes, runsRes, activityRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("riders").select("*, profiles(name)").eq("status", "active"),
      supabase.from("optimization_runs").select("*").order("run_at", { ascending: false }).limit(1),
      user
        ? supabase
            .from("notifications")
            .select("*")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: null }),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (ridersRes.data) setRiders(ridersRes.data as unknown as Rider[]);
    if (runsRes.data && runsRes.data.length > 0) setLastRun(runsRes.data[0]);
    if (activityRes.data) setActivity(activityRes.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    loadData();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login?role=admin");
    router.refresh();
  }

  async function handleParseOrders(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim() || parsingRef.current) return;
    parsingRef.current = true;
    setParsing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/orders/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, editOrderId: focusOrderId ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(focusOrderId ? "Order updated." : `Added ${json.orders.length} order(s).`);
      setRawText("");
      setFocusOrderId(null);
      loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to parse orders");
    } finally {
      setParsing(false);
      parsingRef.current = false;
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (confirmDeleteId !== orderId) {
      setConfirmDeleteId(orderId);
      return;
    }
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (focusOrderId === orderId) {
        setFocusOrderId(null);
        setRawText("");
      }
      loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete order");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleReassignOrder(orderId: string) {
    setReassigningId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/reassign`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Order pulled back to the pending pool.");
      loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to reassign order");
    } finally {
      setReassigningId(null);
    }
  }

  async function handleOptimize() {
    setOptimizing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/optimize", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Routes offered to riders — waiting on acceptance.");
      loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  }

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const offeredCount = orders.filter((o) => o.status === "offered").length;
  const inProgressCount = orders.filter((o) => o.status === "assigned").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const distanceSaved =
    lastRun && lastRun.total_distance_before > 0
      ? ((lastRun.total_distance_before - lastRun.total_distance_after) / lastRun.total_distance_before) * 100
      : 0;

  return (
    <div className="relative min-h-screen">
      <AmbientBackground accent="amber" />
      <header className="relative overflow-hidden border-b border-border bg-gradient-to-r from-surface via-surface to-amber/10 px-6 py-5 backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber/60 font-display text-lg font-bold text-bg shadow-lg shadow-amber/20">
              D
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold leading-tight">{t("admin.title")}</h1>
              <p className="text-xs text-text-dim">{t("admin.tagline")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {profileId && <NotificationBell profileId={profileId} accent="amber" />}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-dim transition-colors hover:border-amber/50 hover:text-text"
            >
              {t("admin.signOut")}
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label={t("admin.kpi.pending")} value={pendingCount} icon="📥" />
          <KpiCard label={t("admin.kpi.awaitingAccept")} value={offeredCount} icon="⏳" accent="text-amber" />
          <KpiCard label={t("admin.kpi.inProgress")} value={inProgressCount} icon="🛵" accent="text-cyan" />
          <KpiCard label={t("admin.kpi.delivered")} value={deliveredCount} icon="✅" accent="text-success" />
          <KpiCard label={t("admin.kpi.activeRiders")} value={riders.length} icon="🟢" accent="text-success" pulse={riders.length > 0} />
        </div>

        <div className="relative mt-5 flex gap-2">
          {(
            [
              ["dispatch", t("admin.tab.dispatch")],
              ["products", t("admin.tab.products")],
              ["users", t("admin.tab.users")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === key ? "bg-amber text-bg" : "border border-border bg-surface-raised text-text-dim hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "products" && <ProductsTab />}
      {tab === "users" && <UsersTab />}

      {tab === "dispatch" && (
      <main className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          {lastRun && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/10 via-surface to-surface p-4"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-dim">Last optimization</p>
              <div className="flex items-baseline gap-2">
                <StatCounter
                  value={lastRun.total_distance_after}
                  suffix=" km"
                  className="font-display text-3xl font-bold text-cyan"
                />
                <span className="text-xs text-text-dim line-through">
                  {lastRun.total_distance_before.toFixed(1)} km
                </span>
              </div>
              <p className="mt-1 text-xs text-success">
                {distanceSaved > 0 ? `${distanceSaved.toFixed(0)}% shorter than naive baseline` : ""}
              </p>
            </motion.section>
          )}

          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
                <span>✨</span> {focusOrderId ? t("admin.editTagged") : t("admin.addOrders")}
              </h2>
              {focusOrderId && (
                <button
                  onClick={() => {
                    setFocusOrderId(null);
                    setRawText("");
                  }}
                  className="text-[10px] font-medium uppercase tracking-wide text-cyan hover:underline"
                >
                  Showing tagged order · clear
                </button>
              )}
            </div>
            <form onSubmit={handleParseOrders} className="space-y-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste messy order text, e.g. '2kg parcel to 12 MG Road, Bangalore, deliver between 2-4pm; also one to Koramangala 5th block...'"
                rows={5}
                className={`w-full resize-none rounded-lg border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-amber ${
                  focusOrderId ? "border-cyan/40" : "border-border"
                }`}
              />
              <button
                type="submit"
                disabled={parsing}
                className="w-full rounded-lg bg-gradient-to-r from-amber to-amber/80 py-2.5 text-sm font-semibold text-bg shadow-lg shadow-amber/20 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {parsing ? "Parsing…" : focusOrderId ? "Update this order with Gemini" : "Parse with Gemini"}
              </button>
            </form>
          </section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <h2 className="mb-1 flex items-center gap-1.5 font-display text-sm font-semibold">
              <span>🟢</span> {t("admin.activeRidersHeading")} ({riders.length})
            </h2>
            <p className="mb-3 text-xs text-text-dim">
              Riders create their own accounts from the{" "}
              <a href="/rider/signup" target="_blank" rel="noreferrer" className="text-cyan hover:underline">
                rider portal
              </a>{" "}
              and only appear here while online. Click one to locate them.
            </p>
            <div className="space-y-1.5">
              {riders.map((rider, idx) => {
                const isLive =
                  rider.location_updated_at && now - new Date(rider.location_updated_at).getTime() < 2 * 60 * 1000;
                const isSuspended = !!rider.suspended_until && new Date(rider.suspended_until).getTime() > now;
                return (
                  <button
                    key={rider.id}
                    onClick={() => {
                      setFocusRiderId(rider.id);
                      setFocusOrderId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      focusRiderId === rider.id
                        ? "border-cyan/60 bg-cyan/10"
                        : "border-border bg-surface-raised hover:border-cyan/30"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-bg"
                        style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                      >
                        {(rider.profiles?.name ?? "R").charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <span className="block">{rider.profiles?.name ?? "Rider"}</span>
                        {isSuspended && <span className="block text-[10px] text-danger">suspended</span>}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] uppercase ${isLive ? "text-success" : "text-text-dim"}`}
                      title={isLive ? "GPS updated within the last 2 minutes" : "No recent GPS ping — location on map may be stale"}
                    >
                      {isLive ? "● live gps" : "no gps"}
                    </span>
                  </button>
                );
              })}
              {riders.length === 0 && (
                <p className="py-4 text-center text-xs text-text-dim">{t("admin.noRidersOnline")}</p>
              )}
            </div>
          </motion.section>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleOptimize}
            disabled={optimizing || riders.length === 0}
            className="w-full rounded-xl bg-gradient-to-r from-cyan to-cyan/70 py-3.5 text-sm font-bold text-bg shadow-lg shadow-cyan/20 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {optimizing ? "Optimizing…" : `⚡ ${t("admin.optimizeRoutes")}`}
          </motion.button>

          <AnimatePresence>
            {message && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-dim"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold">
              <span>📜</span> {t("admin.activity")}
            </h2>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              <AnimatePresence initial={false}>
                {activity.map((n) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-lg bg-surface-raised px-3 py-2 text-xs"
                  >
                    <p className="font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-text-dim">{n.body}</p>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {activity.length === 0 && (
                <p className="py-4 text-center text-xs text-text-dim">{t("admin.noActivity")}</p>
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <h2 className="mb-3 font-display text-sm font-semibold">
              {t("admin.orders")} ({orders.length})
            </h2>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              <AnimatePresence initial={false}>
                {orders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs transition-colors ${
                      focusOrderId === order.id ? "border-cyan/60 bg-cyan/10" : "border-transparent bg-surface-raised"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setFocusOrderId(order.id);
                        setFocusRiderId(null);
                        setRawText(order.raw_text);
                      }}
                      className="flex min-w-0 flex-grow items-center justify-between gap-2 px-1.5 py-1 text-left hover:opacity-80"
                    >
                      <span className="truncate pr-2">{order.address}</span>
                      <StatusPill status={order.status} />
                    </button>
                    {(order.status === "assigned" || order.status === "offered") && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleReassignOrder(order.id)}
                        disabled={reassigningId === order.id}
                        title="Pull this order back to pending (rider stuck/unresponsive)"
                        className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-text-dim transition-colors hover:bg-amber/15 hover:text-amber"
                      >
                        {reassigningId === order.id ? "…" : "↺"}
                      </motion.button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteOrder(order.id)}
                      onBlur={() => setConfirmDeleteId((id) => (id === order.id ? null : id))}
                      disabled={deletingId === order.id}
                      title={confirmDeleteId === order.id ? "Click again to confirm delete" : "Delete order"}
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                        confirmDeleteId === order.id
                          ? "bg-danger text-white"
                          : "text-text-dim hover:bg-danger/15 hover:text-danger"
                      }`}
                    >
                      {deletingId === order.id ? "…" : confirmDeleteId === order.id ? "Confirm?" : "🗑"}
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {orders.length === 0 && (
                <p className="py-4 text-center text-xs text-text-dim">{t("admin.noOrders")}</p>
              )}
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-[500px] overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/20 lg:min-h-0"
        >
          <RouteMapClient
            orders={orders.map((o) => ({
              id: o.id,
              lat: o.lat,
              lng: o.lng,
              address: o.address,
              status: o.status,
              assigned_rider_id: o.assigned_rider_id,
              sequence_in_route: o.sequence_in_route,
            }))}
            riders={riders.map((r) => ({
              id: r.id,
              depot_lat: r.depot_lat,
              depot_lng: r.depot_lng,
              name: r.profiles?.name ?? "Rider",
              current_lat: r.current_lat,
              current_lng: r.current_lng,
            }))}
            focusRiderId={focusRiderId}
            focusOrderId={focusOrderId}
            showLocateMe
          />
        </motion.section>
      </main>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent = "text-text",
  pulse = false,
}: {
  label: string;
  value: number;
  icon: string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-xl border border-border bg-surface-raised/70 p-3 backdrop-blur transition-colors hover:border-amber/30"
    >
      <div className="flex items-center justify-between">
        <StatCounter value={value} decimals={0} className={`font-display text-xl font-bold ${accent}`} />
        <span className="relative text-lg leading-none">
          {icon}
          {pulse && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-success" />}
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-text-dim">{label}</p>
    </motion.div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-text-dim/20 text-text-dim",
    offered: "bg-amber/20 text-amber",
    assigned: "bg-cyan/20 text-cyan",
    delivered: "bg-success/20 text-success",
    failed: "bg-danger/20 text-danger",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}
