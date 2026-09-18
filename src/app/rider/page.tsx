"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { RouteMapClient } from "@/components/RouteMapClient";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AmbientBackground } from "@/components/AmbientBackground";
import { StatCounter } from "@/components/StatCounter";
import { useLanguage } from "@/components/LanguageProvider";
import { useSweepPolling } from "@/lib/useSweepPolling";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;
type Rider = Tables<"riders">;

const OFFER_WINDOW_MS = 5 * 60 * 1000;
const EARNING_BASE = 35;
const EARNING_PER_KG = 12;

export default function RiderDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [rider, setRider] = useState<Rider | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useSweepPolling();

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setProfileId(user.id);

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    if (profile) setName(profile.name);

    const { data: riderRow } = await supabase.from("riders").select("*").eq("profile_id", user.id).single();
    if (!riderRow) return;
    setRider(riderRow);

    const { data: myOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_rider_id", riderRow.id)
      .order("sequence_in_route", { ascending: true });
    if (myOrders) setOrders(myOrders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    loadData();
    const channel = supabase
      .channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  useEffect(() => {
    if (!rider || rider.status !== "active" || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        supabase.rpc("update_my_location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // permission denied or unavailable — live tracking just stays off
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.id, rider?.status]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login?role=rider");
    router.refresh();
  }

  async function toggleStatus() {
    if (!rider) return;
    setTogglingStatus(true);
    setErrorMsg(null);
    const nextStatus = rider.status === "active" ? "inactive" : "active";
    const { error } = await supabase.rpc("set_my_status", { new_status: nextStatus });
    if (error) {
      setErrorMsg("Couldn't update your status — try again.");
      setTogglingStatus(false);
      return;
    }
    if (nextStatus === "inactive") {
      const res = await fetch("/api/rider/go-offline", { method: "POST" });
      if (!res.ok) setErrorMsg("You're offline, but some deliveries may not have been handed back yet.");
    }
    await loadData();
    setTogglingStatus(false);
  }

  async function acceptOrder(orderId: string) {
    setAccepting(orderId);
    setErrorMsg(null);
    const { error } = await supabase.rpc("accept_order", { order_id: orderId });
    if (error) {
      setErrorMsg("Too slow — that delivery just went to someone else.");
    }
    await loadData();
    setAccepting(null);
  }

  async function markDelivered(orderId: string) {
    setErrorMsg(null);
    const { error } = await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
    if (error) setErrorMsg("Couldn't mark that as delivered — try again.");
    loadData();
  }

  const offered = orders.filter((o) => o.status === "offered");
  const remaining = orders.filter((o) => o.status === "assigned");
  const done = orders.filter((o) => o.status === "delivered");
  const isActive = rider?.status === "active";
  const isSuspended = !!rider?.suspended_until && new Date(rider.suspended_until).getTime() > now;
  const earnings = done.reduce((sum, o) => sum + EARNING_BASE + o.weight * EARNING_PER_KG, 0);

  return (
    <div className="relative min-h-screen pb-10">
      <AmbientBackground accent={isSuspended ? "amber" : isActive ? "success" : "cyan"} />

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative overflow-hidden border-b border-border bg-gradient-to-br from-surface via-surface to-cyan/10 px-5 pb-6 pt-5 backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.span
              animate={isActive ? { boxShadow: ["0 0 0 0 rgba(61,220,151,0.4)", "0 0 0 8px rgba(61,220,151,0)"] } : {}}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-cyan/60 font-display text-lg font-bold text-bg"
            >
              {(name || "R").charAt(0).toUpperCase()}
            </motion.span>
            <div>
              <p className="text-xs text-text-dim">{t("rider.welcomeBack")}</p>
              <h1 className="font-display text-xl font-semibold">{name || "Rider"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {profileId && <NotificationBell profileId={profileId} accent="cyan" />}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-dim transition-colors hover:border-cyan/50 hover:text-text"
            >
              {t("rider.signOut")}
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-5 flex items-center justify-between rounded-2xl border border-border bg-surface-raised/80 p-4 backdrop-blur"
        >
          <div className="flex items-center gap-2.5">
            {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
            <div>
              <p className="text-xs uppercase tracking-wide text-text-dim">Status</p>
              <p className={`font-display text-lg font-semibold ${isActive ? "text-success" : "text-text-dim"}`}>
                {isActive ? t("rider.online") : t("rider.offline")}
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={toggleStatus}
            disabled={togglingStatus || !rider}
            className={`relative h-9 w-16 rounded-full transition-colors ${isActive ? "bg-success" : "bg-border"}`}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-1 h-7 w-7 rounded-full bg-white shadow-md"
              style={{ left: isActive ? "calc(100% - 32px)" : "4px" }}
            />
          </motion.button>
        </motion.div>

        {isSuspended && rider?.suspended_until && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
          >
            Suspended from new offers until{" "}
            {new Date(rider.suspended_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} due to
            repeated missed deliveries.
          </motion.div>
        )}

        <div className="relative mt-4 grid grid-cols-3 gap-3">
          <RiderStat label={t("rider.delivered")} value={done.length} />
          <RiderStat label={t("rider.earnings")} value={earnings} prefix="₹" decimals={0} />
          <RiderStat label={t("rider.missedStreak")} value={rider?.consecutive_missed_offers ?? 0} warn />
        </div>
      </header>

      <AnimatePresence>
        {offered.map((order) => (
          <OfferCard
            key={order.id}
            order={order}
            now={now}
            onAccept={() => acceptOrder(order.id)}
            accepting={accepting === order.id}
          />
        ))}
      </AnimatePresence>

      <div className="mx-4 mt-4 h-56 overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/10">
        {rider && (
          <RouteMapClient
            orders={orders
              .filter((o) => o.status !== "offered")
              .map((o) => ({
                id: o.id,
                lat: o.lat,
                lng: o.lng,
                address: o.address,
                status: o.status,
                assigned_rider_id: o.assigned_rider_id,
                sequence_in_route: o.sequence_in_route,
              }))}
            riders={[
              {
                id: rider.id,
                depot_lat: rider.depot_lat,
                depot_lng: rider.depot_lng,
                name,
                current_lat: rider.current_lat,
                current_lng: rider.current_lng,
              },
            ]}
            showLocateMe
          />
        )}
      </div>

      <main className="space-y-3 p-4">
        <p className="text-sm text-text-dim">
          {remaining.length} {t("rider.stopsInProgress")}
        </p>

        {remaining.map((order, idx) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -2 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lg shadow-black/10 transition-colors hover:border-cyan/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber/20 font-display text-sm font-semibold text-amber">
              {(order.sequence_in_route ?? idx) + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{order.address}</p>
              <p className="text-xs text-text-dim">{order.weight} kg</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => markDelivered(order.id)}
              className="shrink-0 rounded-xl bg-success/20 px-3.5 py-2.5 text-xs font-semibold text-success"
            >
              {t("rider.deliveredBtn")}
            </motion.button>
          </motion.div>
        ))}

        {remaining.length === 0 && offered.length === 0 && !isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center"
          >
            <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }} className="mb-3 text-3xl">
              💤
            </motion.span>
            <p className="text-sm text-text-dim">{t("rider.offlineHint")}</p>
          </motion.div>
        )}

        {remaining.length === 0 && offered.length === 0 && isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center rounded-2xl border border-cyan/30 bg-cyan/5 p-10 text-center text-cyan"
          >
            <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mb-3 text-3xl">
              📡
            </motion.span>
            <p className="text-sm">{t("rider.waitingHint")}</p>
          </motion.div>
        )}

        {done.length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-xs text-text-dim">{done.length} delivered today</summary>
            <div className="mt-2 space-y-1.5">
              {done.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-dim line-through"
                >
                  {order.address}
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}

function RiderStat({
  label,
  value,
  prefix = "",
  decimals = 0,
  warn = false,
}: {
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised/60 p-3 text-center backdrop-blur">
      <span className="inline-flex items-baseline gap-0.5">
        {prefix && <span className="text-xs text-text-dim">{prefix}</span>}
        <StatCounter
          value={value}
          decimals={decimals}
          className={`font-display text-lg font-bold ${warn && value > 0 ? "text-danger" : "text-text"}`}
        />
      </span>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-text-dim">{label}</p>
    </div>
  );
}

function OfferCard({
  order,
  now,
  onAccept,
  accepting,
}: {
  order: Order;
  now: number;
  onAccept: () => void;
  accepting: boolean;
}) {
  const { t } = useLanguage();
  const offeredAt = order.offered_at ? new Date(order.offered_at).getTime() : now;
  const remainingMs = Math.max(0, offeredAt + OFFER_WINDOW_MS - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const progress = Math.max(0, Math.min(1, remainingMs / OFFER_WINDOW_MS));
  const circumference = 2 * Math.PI * 18;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: ["0 0 0 0 rgba(255,176,32,0.3)", "0 0 0 10px rgba(255,176,32,0)"],
      }}
      transition={{ boxShadow: { duration: 1.6, repeat: Infinity } }}
      exit={{ opacity: 0, y: -16, scale: 0.96 }}
      className="mx-4 mt-4 overflow-hidden rounded-2xl border-2 border-amber bg-gradient-to-br from-amber/15 via-surface to-surface p-4 shadow-2xl shadow-amber/10"
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg width="48" height="48" className="-rotate-90">
            <circle cx="24" cy="24" r="18" stroke="#262d38" strokeWidth="4" fill="none" />
            <circle
              cx="24"
              cy="24"
              r="18"
              stroke="#ffb020"
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute font-mono text-[10px] font-semibold text-amber">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber">{t("rider.newRequest")}</p>
          <p className="truncate text-sm font-semibold">{order.address}</p>
          <p className="text-xs text-text-dim">{order.weight} kg</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onAccept}
          disabled={accepting}
          className="shrink-0 rounded-xl bg-amber px-4 py-3 text-sm font-bold text-bg disabled:opacity-60"
        >
          {accepting ? "…" : t("rider.accept")}
        </motion.button>
      </div>
    </motion.div>
  );
}
