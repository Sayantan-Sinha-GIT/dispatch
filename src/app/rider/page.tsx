"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { RouteMapClient } from "@/components/RouteMapClient";
import { NotificationBell } from "@/components/NotificationBell";
import { SignOutButton } from "@/components/SignOutButton";
import { PortalBar } from "@/components/PortalBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DataSaverToggle } from "@/components/DataSaverToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AmbientBackground } from "@/components/AmbientBackground";
import { OfferModal } from "@/components/rider/OfferModal";
import { LocationControl } from "@/components/rider/LocationControl";
import { DeliverConfirm } from "@/components/rider/DeliverConfirm";
import { formatDateTime } from "@/lib/datetime";
import { directionsUrl, routeUrl, MAX_ROUTE_STOPS } from "@/lib/maps";
import { openNativeAppSettings, startBackgroundLocation } from "@/lib/nativeApp";
import { StatCounter } from "@/components/StatCounter";
import { useLanguage } from "@/components/LanguageProvider";
import { useSweepPolling } from "@/lib/useSweepPolling";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;
type Rider = Tables<"riders">;


export default function RiderDashboard() {
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [rider, setRider] = useState<Rider | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [deliverSubmitting, setDeliverSubmitting] = useState(false);

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

  useSweepPolling(20000, loadData);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    loadData();
    const channel = supabase
      .channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, () => loadData())
      // An order taken away stops matching this rider's RLS policy in the same
      // statement that removes it, so no orders event arrives. The notification
      // written alongside it does, and is the reliable signal.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => loadData())
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

  /*
   * Live position while online. In the Android app it keeps going with the
   * screen off or another app open (a location foreground service, with its
   * ongoing notification); in a browser it only runs while the page is open.
   * Going offline or signing out ends it - both change the status this
   * depends on, or unmount the page.
   */
  const [locationDenied, setLocationDenied] = useState(false);
  useEffect(() => {
    if (!rider || rider.status !== "active") return;
    let stopped = false;
    let stop: (() => void) | null = null;
    let lastSent = 0;
    const send = (lat: number, lng: number) => {
      // At most every 10 s, however chatty the GPS is.
      if (Date.now() - lastSent < 10_000) return;
      lastSent = Date.now();
      supabase.rpc("update_my_location", { lat, lng });
    };

    startBackgroundLocation(
      { title: t("rider.bgloc.title"), message: t("rider.bgloc.message") },
      (lat, lng) => {
        setLocationDenied(false);
        send(lat, lng);
      },
      () => setLocationDenied(true),
    )
      .then((stopNative) => {
        if (stopNative) {
          if (stopped) stopNative();
          else stop = stopNative;
          return;
        }
        if (stopped || !("geolocation" in navigator)) return;
        const watchId = navigator.geolocation.watchPosition(
          (pos) => send(pos.coords.latitude, pos.coords.longitude),
          () => {
            // permission denied or unavailable - live tracking just stays off
          },
          { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
        );
        stop = () => navigator.geolocation.clearWatch(watchId);
      })
      .catch(() => {});

    return () => {
      stopped = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.id, rider?.status]);


  async function toggleStatus() {
    if (!rider) return;
    setTogglingStatus(true);
    setErrorMsg(null);
    const nextStatus = rider.status === "active" ? "inactive" : "active";
    const { error } = await supabase.rpc("set_my_status", { new_status: nextStatus });
    if (error) {
      setErrorMsg(t("rider.err.statusUpdate"));
      setTogglingStatus(false);
      return;
    }

    /*
     * The switch is done the moment the status lands. What follows - handing
     * off un-accepted offers, or sweeping for waiting work - is dispatch
     * bookkeeping that can take seconds, and awaiting it left the toggle
     * visibly stuck and feeling broken.
     *
     * So the UI updates now and the bookkeeping runs behind it, reconciling
     * when it finishes.
     */
    setRider((r) => (r ? { ...r, status: nextStatus } : r));
    setTogglingStatus(false);

    const followUp =
      nextStatus === "inactive"
        ? fetch("/api/rider/go-offline", { method: "POST" }).then((res) => {
            if (!res.ok) setErrorMsg(t("rider.err.offlinePartial"));
          })
        : fetch("/api/offers/sweep", { method: "POST" });

    followUp.catch(() => {}).finally(() => loadData());
  }

  async function acceptOrder(orderId: string) {
    setAccepting(orderId);
    setErrorMsg(null);
    const { error } = await supabase.rpc("accept_order", { order_id: orderId });
    if (error) {
      setErrorMsg(t("rider.err.tooSlow"));
    }
    await loadData();
    setAccepting(null);
  }

  async function declineOrder(orderId: string) {
    setDeclining(orderId);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/rider/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) setErrorMsg(t("rider.err.declineFailed"));
    } catch {
      setErrorMsg(t("rider.err.declineFailed"));
    }
    await loadData();
    setDeclining(null);
  }

  async function markDelivered(code: string) {
    if (!deliveringOrder) return;
    setDeliverError(null);
    setDeliverSubmitting(true);
    const { data, error } = await supabase.rpc("mark_order_delivered", {
      p_order_id: deliveringOrder.id,
      p_code: code,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setDeliverSubmitting(false);

    if (error || !result?.ok) {
      /*
       * Every non-code failure used to surface as one opaque sentence. A rider
       * holding the right code was told to "try again" when the real problem
       * was that the order had never been accepted - which is a different
       * action entirely, and invisible from that message.
       */
      const reason = result?.error;
      setDeliverError(
        reason === "bad_code"
          ? t("rider.deliver.badCode")
          : reason === "not_accepted"
            ? t("rider.deliver.notAccepted")
            : reason === "not_yours"
              ? t("rider.deliver.notYours")
              : reason === "not_a_rider"
                ? t("rider.deliver.notARider")
                : t("rider.err.markDelivered"),
      );
      // The sheet is showing stale state if the order moved on without us.
      if (reason === "not_accepted" || reason === "not_yours") loadData();
      return;
    }
    setDeliveringOrder(null);
    loadData();
  }

  const offered = orders.filter((o) => o.status === "offered");
  const remaining = orders.filter((o) => o.status === "assigned");
  const done = orders.filter((o) => o.status === "delivered");
  // "Active" is exactly the work still owed: an offer waiting on a decision
  // plus an accepted run. Delivered and cancelled are neither, which is why
  // this is derived here once rather than counted differently per panel.
  const activeCount = offered.length + remaining.length;
  const isActive = rider?.status === "active";
  const isSuspended = !!rider?.suspended_until && new Date(rider.suspended_until).getTime() > now;
  const earnings = done.reduce((sum, o) => sum + Number(o.payout_amount ?? 0), 0);

  return (
    <div className="relative min-h-screen pb-10">
      <AmbientBackground accent={isSuspended ? "brand" : isActive ? "success" : "zest"} />

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            key="rider-error"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed left-1/2 top-[calc(var(--safe-top)+1rem)] z-50 -translate-x-1/2 rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <PortalBar>
        <LanguageToggle className="hidden sm:flex" />
        <DataSaverToggle />
        <ThemeToggle className="hidden sm:flex" />
        {profileId && <NotificationBell profileId={profileId} accent="zest" />}
        <SignOutButton role="rider" />
      </PortalBar>

      {/* The rider's cockpit: an ink sheet, as in the reference's "why us"
          block, with lime as the rider's own colour. It stays dark in both
          themes: it is read outdoors, at a glance, often in sunlight. */}
      <section className="mx-auto max-w-[1400px] px-2.5 pt-2.5 sm:px-4 sm:pt-4">
        <div className="sheet-ink relative overflow-hidden px-5 pb-5 pt-7 sm:px-10 sm:pb-8 sm:pt-10">
          <div
            className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-colors duration-700 ${
              isSuspended ? "bg-danger/25" : isActive ? "bg-lime/25" : "bg-brand/30"
            }`}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <motion.span
                animate={isActive ? { boxShadow: ["0 0 0 0 rgba(200,243,74,0.45)", "0 0 0 10px rgba(200,243,74,0)"] } : {}}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-lime font-display text-2xl font-light text-ink"
              >
                {(name || "R").charAt(0).toUpperCase()}
              </motion.span>
              <div>
                <p className="text-sm text-white/55">{t("rider.welcomeBack")}</p>
                <h1 className="font-display text-3xl font-light tracking-[-0.04em] sm:text-5xl">{name || t("common.rider")}</h1>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={toggleStatus}
              disabled={togglingStatus || !rider}
              role="switch"
              aria-checked={isActive}
              aria-label={t("rider.statusLabel")}
              className={`flex w-full items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 transition-colors duration-500 sm:w-auto sm:min-w-[17rem] ${
                isActive ? "bg-lime text-ink" : "bg-white/10 text-white ring-1 ring-white/15"
              }`}
            >
              <span className="flex flex-1 flex-col text-left">
                <span className={`text-[11px] ${isActive ? "text-ink/60" : "text-white/50"}`}>{t("rider.statusLabel")}</span>
                <span className="font-display text-lg font-normal leading-tight">{isActive ? t("rider.online") : t("rider.offline")}</span>
              </span>
              <span className={`relative h-11 w-20 rounded-full transition-colors ${isActive ? "bg-ink" : "bg-white/15"}`}>
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`absolute top-1.5 h-8 w-8 rounded-full shadow-md ${isActive ? "bg-lime" : "bg-white"}`}
                  style={{ left: isActive ? "calc(100% - 38px)" : "6px" }}
                />
              </span>
            </motion.button>
          </div>

          {isSuspended && rider?.suspended_until && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mt-5 rounded-2xl bg-danger/15 px-4 py-3 text-sm text-[#ff9aae]"
            >
              {t("rider.suspendedUntil", { time: new Date(rider.suspended_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
            </motion.div>
          )}

          <div className="relative mt-8 grid grid-cols-3 gap-2 sm:gap-3">
            <RiderStat label={t("rider.delivered")} value={done.length} />
            <RiderStat label={t("rider.earnings")} value={earnings} prefix="₹" decimals={0} />
            <RiderStat label={t("rider.missedStreak")} value={rider?.consecutive_missed_offers ?? 0} warn />
          </div>
        </div>
      </section>

      {/* One offer at a time, front and centre — a rider glancing at this
          between stops shouldn't have to pick out of a list.

          Deliberately not wrapped in AnimatePresence: its direct child would be
          a plain component, which never reports that its exit finished, so the
          sheet is left in the DOM frozen on its last render. A stuck offer
          sheet covers the entire app. Entrance animation, no exit. */}
      {offered.length > 0 && (
        <OfferModal
          key={offered[0].id}
          order={offered[0]}
          now={now}
          onAccept={() => acceptOrder(offered[0].id)}
          onDecline={() => declineOrder(offered[0].id)}
          accepting={accepting === offered[0].id}
          declining={declining === offered[0].id}
          queuedCount={offered.length - 1}
        />
      )}

      {deliveringOrder && (
        <DeliverConfirm
          key={deliveringOrder.id}
          address={deliveringOrder.address}
          submitting={deliverSubmitting}
          error={deliverError}
          onConfirm={markDelivered}
          onCancel={() => {
            setDeliveringOrder(null);
            setDeliverError(null);
          }}
        />
      )}

      <div className="mx-4 mt-4 space-y-3">
        {locationDenied && isActive && (
          <div className="flex items-center gap-3 rounded-2xl bg-danger/10 p-3.5 text-sm text-danger ring-1 ring-danger/25">
            <p className="min-w-0 flex-1 leading-snug">{t("rider.bgloc.denied")}</p>
            <button
              type="button"
              onClick={openNativeAppSettings}
              className="shrink-0 rounded-full bg-danger px-3.5 py-2 text-xs font-semibold text-white"
            >
              {t("rider.bgloc.openSettings")}
            </button>
          </div>
        )}
        {rider && <LocationControl rider={rider} onChanged={loadData} />}
      </div>

      <div className="mx-4 mt-3 h-56 overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/10">
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

      <main className="mx-auto max-w-[1400px] space-y-3 px-2.5 pt-3 sm:px-4 sm:pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-dim">
            {remaining.length} {t("rider.stopsInProgress")}
          </p>
          <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-text-dim">
            {t("rider.activeOrders", { count: activeCount })}
          </span>
        </div>

        {/* With several stops, the whole run in its planned order in one tap. */}
        {remaining.length > 1 && (
          <a
            href={routeUrl(remaining)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white ring-1 ring-white/10 transition-transform active:scale-[0.98] dark:bg-surface-raised"
          >
            <NavigateIcon className="h-4 w-4 text-lime" />
            {remaining.length > MAX_ROUTE_STOPS
              ? t("rider.fullRouteFirst", { count: MAX_ROUTE_STOPS })
              : t("rider.fullRoute", { count: remaining.length })}
          </a>
        )}

        {remaining.map((order, idx) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -2 }}
            transition={{ delay: idx * 0.05 }}
            className="rounded-2xl card-soft border border-transparent bg-surface p-4 shadow-lg shadow-black/10 transition-colors hover:border-zest/30"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/20 font-display text-sm font-semibold text-brand">
                {(order.sequence_in_route ?? idx) + 1}
              </span>
              <div className="min-w-0 flex-1">
                {/* The full address, not a truncated one: it is what the rider
                    reads at the door. */}
                <p className="text-sm font-medium leading-snug">{order.address}</p>
                <p className="mt-0.5 text-xs text-text-dim">
                  {order.weight} {t("common.kg")} · ₹{Math.round(Number(order.payout_amount ?? 0))} ·{" "}
                  {order.payout_distance_km ?? 0} {t("common.km")}
                </p>
                <p className="mt-0.5 text-[11px] text-text-dim">
                  {t("rider.placedAt", { when: formatDateTime(order.created_at, lang) })}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={directionsUrl(order)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-full bg-lime px-3.5 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95"
              >
                <NavigateIcon className="h-4 w-4" />
                {t("rider.navigate")}
              </a>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setDeliverError(null);
                  setDeliveringOrder(order);
                }}
                className="rounded-full bg-success/15 px-3.5 py-2.5 text-sm font-semibold text-success"
              >
                {t("rider.deliveredBtn")}
              </motion.button>
            </div>
          </motion.div>
        ))}

        {remaining.length === 0 && offered.length === 0 && !isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="surface-raised-soft grain flex flex-col items-center rounded-3xl p-10 text-center ring-1 ring-border/60"
          >
            <motion.div
              animate={{ opacity: [0.55, 1, 0.55], y: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              className="relative mb-4"
            >
              <Image src="/images/empty/rider-idle.webp" alt="" width={130} height={130} className="opacity-80" />
            </motion.div>
            <p className="text-sm text-text-dim">{t("rider.offlineHint")}</p>
          </motion.div>
        )}

        {remaining.length === 0 && offered.length === 0 && isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center rounded-2xl border border-zest/30 bg-zest/5 p-10 text-center text-zest"
          >
            <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mb-3 text-3xl">
              📡
            </motion.span>
            <p className="text-sm">{t("rider.waitingHint")}</p>
          </motion.div>
        )}

        {done.length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-xs text-text-dim">{t("rider.deliveredToday", { count: done.length })}</summary>
            <div className="mt-2 space-y-1.5">
              {done.map((order) => (
                <div key={order.id} className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-dim">
                  <span className="line-through">{order.address}</span>
                  <span className="ml-2 whitespace-nowrap text-[11px]">
                    {formatDateTime(order.delivered_at ?? order.created_at, lang)}
                  </span>
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
    <div className="rounded-[1.4rem] bg-white/[0.06] p-3.5 ring-1 ring-white/10 sm:rounded-[1.8rem] sm:p-5">
      <span className="inline-flex items-baseline gap-0.5">
        {prefix && <span className="text-sm text-white/50">{prefix}</span>}
        <StatCounter
          value={value}
          decimals={decimals}
          className={`font-display text-3xl font-light tracking-[-0.04em] sm:text-5xl ${warn && value > 0 ? "text-[#ff9aae]" : "text-white"}`}
        />
      </span>
      <p className="mt-1 text-[11px] text-white/50 sm:text-xs">{label}</p>
    </div>
  );
}
function NavigateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.7 2.3a1 1 0 0 0-1.06-.23l-18 7a1 1 0 0 0 .08 1.9l7.6 2.1 2.1 7.6a1 1 0 0 0 .92.73h.04a1 1 0 0 0 .93-.64l7-18a1 1 0 0 0-.23-1.06Z" />
    </svg>
  );
}
