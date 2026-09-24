"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { RouteMapClient } from "@/components/RouteMapClient";
import { NotificationBell } from "@/components/NotificationBell";
import { SignOutButton } from "@/components/SignOutButton";
import { PortalBar } from "@/components/PortalBar";
import { useSweepPolling } from "@/lib/useSweepPolling";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { SupportTab } from "@/components/admin/SupportTab";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DataSaverToggle } from "@/components/DataSaverToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PageBackground } from "@/components/PageBackground";
import { useLanguage } from "@/components/LanguageProvider";
import { CommandConsole } from "@/components/admin/CommandConsole";
import {
  ActivityTimeline,
  OrdersBoard,
  PipelineStrip,
  RidersPanel,
  RoutingCard,
  type AdminRider,
} from "@/components/admin/DispatchPanels";
import { BoxIcon, CloseIcon, LifebuoyIcon, RouteIcon, UsersIcon } from "@/components/admin/icons";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;
type OptimizationRun = Tables<"optimization_runs">;
type Notification = Tables<"notifications">;
type Tab = "dispatch" | "products" | "users" | "support";

export default function AdminDashboard() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [orders, setOrders] = useState<Order[]>([]);
  const [allRiders, setAllRiders] = useState<AdminRider[]>([]);
  const [lastRun, setLastRun] = useState<OptimizationRun | null>(null);
  const [activity, setActivity] = useState<Notification[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [live, setLive] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [focusRiderId, setFocusRiderId] = useState<string | null>(null);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [profileId, setProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dispatch");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  // A notice stays long enough to read, then gets out of the way.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setProfileId(user.id);

    // Every rider, not only the online ones: an order can still belong to a
    // rider who has since gone offline, and the order list should name them.
    const [ordersRes, ridersRes, runsRes, activityRes, ticketsRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("riders").select("*, profiles(name)"),
      supabase.from("optimization_runs").select("*").order("run_at", { ascending: false }).limit(1),
      user
        ? supabase
            .from("notifications")
            .select("*")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: null }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (ridersRes.data) setAllRiders(ridersRes.data as unknown as AdminRider[]);
    if (runsRes.data && runsRes.data.length > 0) setLastRun(runsRes.data[0]);
    if (activityRes.data) setActivity(activityRes.data);
    if (typeof ticketsRes.count === "number") setOpenTickets(ticketsRes.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSweepPolling(20000, loadData);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    loadData();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => loadData())
      // The "Live" badge reports the real socket state, not a decoration.
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  const riders = useMemo(() => allRiders.filter((r) => r.status === "active"), [allRiders]);
  const riderNames = useMemo(
    () => new Map(allRiders.map((r) => [r.id, r.profiles?.name ?? t("common.rider")])),
    [allRiders, t],
  );


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
      if (focusOrderId === orderId) setFocusOrderId(null);
      loadData();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("admin.err.deleteFailed"), tone: "err" });
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
      setMessage({ text: t("admin.msg.orderReassigned"), tone: "ok" });
      loadData();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("admin.err.reassignFailed"), tone: "err" });
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
      setMessage({ text: t("admin.msg.routesOffered"), tone: "ok" });
      loadData();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("admin.err.optimizeFailed"), tone: "err" });
    } finally {
      setOptimizing(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "dispatch", label: t("admin.tab.dispatch"), icon: <RouteIcon /> },
    { key: "products", label: t("admin.tab.products"), icon: <BoxIcon /> },
    { key: "users", label: t("admin.tab.users"), icon: <UsersIcon /> },
    { key: "support", label: t("admin.tab.support"), icon: <LifebuoyIcon />, badge: openTickets },
  ];

  return (
    <div className="relative min-h-screen">
      <PageBackground accent="both" />

      <PortalBar
        wide
        title={
          <span className="flex items-center gap-2">
            <span className="hidden sm:inline">{t("admin.title")}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                live ? "bg-success/15 text-success" : "bg-surface-raised text-text-dim"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-success" : "bg-text-dim"}`} />
              </span>
              {live ? t("admin.live") : t("admin.connecting")}
            </span>
          </span>
        }
      >
        <LanguageToggle className="hidden sm:flex" />
        <DataSaverToggle />
        <ThemeToggle className="hidden sm:flex" />
        {profileId && <NotificationBell profileId={profileId} accent="brand" />}
        <SignOutButton role="admin" />
      </PortalBar>

      <section className="mx-auto max-w-[1600px] px-2.5 pt-2.5 sm:px-4 sm:pt-4">
        <div className="sheet-wash px-5 pb-4 pt-7 sm:px-10 sm:pb-5 sm:pt-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="flex items-center gap-2 text-sm text-text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {t("admin.tagline")}
            </p>
            <h1 className="mt-2 font-display text-4xl font-light tracking-[-0.045em] sm:text-6xl">{t("admin.title")}</h1>
          </motion.div>

          <PipelineStrip orders={orders} ridersOnline={riders.length} />

          <nav className="mt-6 flex gap-1 overflow-x-auto rounded-full bg-surface/70 p-1 [scrollbar-width:none] sm:inline-flex" role="tablist">
            {tabs.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.key)}
                  className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                    active ? "text-white dark:text-ink" : "text-text-dim hover:text-text"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-tab-pill"
                      className="absolute inset-0 rounded-full bg-ink dark:bg-white"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{item.icon}</span>
                  <span className="relative">{item.label}</span>
                  {!!item.badge && (
                    <span className="relative rounded-full bg-lime px-1.5 py-px text-[10px] font-semibold tabular-nums text-ink">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* z-0 makes this its own stacking context, so the map's panes and controls
          (z-index up to 1000) stay beneath the header and its dropdowns. */}
      <main className="relative z-0 mx-auto max-w-[1600px] px-2.5 py-3 sm:px-4 sm:py-4">
        {/* Keyed rather than wrapped in AnimatePresence: with React 19 an
            exit animation can wait forever for a signal that never comes and
            leave the old tab on screen. An entrance alone cannot deadlock. */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "products" && <ProductsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "support" && <SupportTab />}

          {tab === "dispatch" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-6">
                <CommandConsole onChanged={loadData} />
                <RoutingCard
                  lastRun={lastRun}
                  optimizing={optimizing}
                  canOptimize={riders.length > 0}
                  onOptimize={handleOptimize}
                />
                <RidersPanel
                  riders={riders}
                  now={now}
                  focusRiderId={focusRiderId}
                  onFocus={(id) => {
                    setFocusRiderId(id);
                    setFocusOrderId(null);
                  }}
                />
                <ActivityTimeline activity={activity} />
              </div>

              <div className="min-w-0 space-y-6">
                <section className="surface-raised-soft h-[380px] overflow-hidden rounded-2xl ring-1 ring-border/70 sm:h-[460px] lg:h-[520px]">
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
                      name: r.profiles?.name ?? t("common.rider"),
                      current_lat: r.current_lat,
                      current_lng: r.current_lng,
                    }))}
                    focusRiderId={focusRiderId}
                    focusOrderId={focusOrderId}
                    showLocateMe
                  />
                </section>

                <OrdersBoard
                  orders={orders}
                  riderNames={riderNames}
                  focusOrderId={focusOrderId}
                  confirmDeleteId={confirmDeleteId}
                  deletingId={deletingId}
                  reassigningId={reassigningId}
                  onFocus={(id) => {
                    setFocusOrderId(id);
                    setFocusRiderId(null);
                  }}
                  onDelete={handleDeleteOrder}
                  onCancelConfirm={(id) => setConfirmDeleteId((cur) => (cur === id ? null : cur))}
                  onReassign={handleReassignOrder}
                />
              </div>
            </div>
          )}
        </motion.div>

        <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border/50 pt-5 text-[11px] text-text-dim sm:flex-row">
          <span>© {new Date().getFullYear()} {t("footer.rights")}</span>
          <span>{t("footer.builtBy")}</span>
        </footer>
      </main>

      <AnimatePresence>
        {message && (
          <motion.div
            key="admin-toast"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
            className={`fixed inset-x-4 bottom-[calc(var(--safe-bottom)+1.25rem)] z-[1100] mx-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md sm:left-auto sm:right-6 sm:mx-0 ${
              message.tone === "ok"
                ? "border-success/30 bg-surface/95 text-text"
                : "border-danger/40 bg-surface/95 text-text"
            }`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${message.tone === "ok" ? "bg-success" : "bg-danger"}`} />
            <p className="flex-1 leading-relaxed">{message.text}</p>
            <button
              onClick={() => setMessage(null)}
              aria-label={t("admin.dismiss")}
              className="-mr-1 rounded-md p-1 text-text-dim hover:text-text"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
