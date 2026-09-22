"use client";

import { use, useEffect, useState } from "react";
import { PageBackground } from "@/components/PageBackground";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { RouteMapClient } from "@/components/RouteMapClient";
import { AmbientBackground } from "@/components/AmbientBackground";
import { useLanguage } from "@/components/LanguageProvider";
import { CancelWindow } from "@/components/shop/CancelWindow";
import { SupportSheet } from "@/components/shop/SupportSheet";
import { DeliveryCodeCard, DisputeCard } from "@/components/shop/DeliveryProof";
import { formatDateTime } from "@/lib/datetime";
import type { Tables } from "@/lib/supabase/types";

type Rider = Tables<"riders"> & { profiles?: { name: string } | null };
type Order = Tables<"orders"> & { riders?: Rider | null };

const STEPS = [
  { key: "placed", labelKey: "tracking.step.placed", icon: "🧾" },
  { key: "offered", labelKey: "tracking.step.offered", icon: "📡" },
  { key: "assigned", labelKey: "tracking.step.assigned", icon: "🛵" },
  { key: "delivered", labelKey: "tracking.step.delivered", icon: "🎉" },
];

function stepIndex(status: string) {
  if (status === "delivered") return 3;
  if (status === "assigned") return 2;
  if (status === "offered") return 1;
  if (status === "expired") return 0;
  return 0;
}

const CONFETTI = ["🎉", "✨", "🎊", "⭐", "💛"];

function Confetti() {
  // A lazy initialiser runs once, at mount, so the randomness stays out of render.
  const [pieces] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      emoji: CONFETTI[i % CONFETTI.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 120,
    })),
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 text-2xl"
          style={{ left: `${p.left}%` }}
          initial={{ y: -40, opacity: 0, x: 0, rotate: 0 }}
          animate={{ y: 420, opacity: [0, 1, 1, 0], x: p.drift, rotate: 360 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ShopOrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [justDelivered, setJustDelivered] = useState(false);
  // A mangled link is simply not an order; asking the database about it only
  // earns a 400 from Postgres, which cannot compare text to a uuid.
  const validId = UUID.test(id);
  const notFound = missing || !validId;

  useEffect(() => {
    if (!validId) return;
    const supabase = createClient();
    const load = () =>
      supabase
        .from("orders")
        .select("*, riders(*, profiles(name))")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            setMissing(true);
            return;
          }
          setOrder((prev) => {
            if (prev && prev.status !== "delivered" && data?.status === "delivered") {
              setJustDelivered(true);
              setTimeout(() => setJustDelivered(false), 4000);
            }
            return data as unknown as Order;
          });
        });

    load();
    const channel = supabase
      .channel(`shop-order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, validId]);

  if (notFound) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-sm text-text-dim">
        <AmbientBackground accent="amber" />
        <span className="text-3xl">🚫</span>
        <p className="text-base font-semibold text-text">{t("tracking.cancelled.title")}</p>
        <p className="max-w-xs">{t("tracking.cancelled.body")}</p>
        <Link href="/shop/orders" className="mt-2 rounded-full bg-amber px-5 py-2 font-semibold text-bg">
          {t("tracking.backToOrders")}
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg text-sm text-text-dim">
        <AmbientBackground accent="cyan" />
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="mr-2 text-lg">
          🛵
        </motion.span>
        {t("tracking.loading")}
      </div>
    );
  }

  const active = stepIndex(order.status);
  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";
  const accent: "amber" | "cyan" | "success" = isDelivered ? "success" : active >= 2 ? "cyan" : "amber";
  const items = Array.isArray(order.items) ? (order.items as { name: string; qty: number; price: number }[]) : [];
  const rider = order.riders ?? null;
  const stepTimestamps: Record<string, string | null> = {
    placed: order.created_at,
    offered: order.offered_at,
    assigned: order.accepted_at,
    delivered: order.delivered_at,
  };

  return (
    <div className="relative min-h-screen pb-10">
      <PageBackground accent="cyan" image="/images/landing/how-it-works.webp" imageOpacity={0.13} />
      <AmbientBackground accent={accent} />
      <AnimatePresence>{justDelivered && <Confetti />}</AnimatePresence>

      <header className="flex items-center gap-3.5 border-b border-border/60 px-5 py-5 backdrop-blur-sm">
        <Link href="/shop/orders" className="text-text">
          ←
        </Link>
        <div>
          <p className="text-[11px] text-text-dim">
            {t("tracking.orderNumber")} #{order.id.slice(0, 8)} · {formatDateTime(order.created_at, lang)}
          </p>
          <motion.h1
            key={order.status}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-lg font-semibold"
          >
            {isCancelled ? t("tracking.head.cancelled") : isDelivered ? t("tracking.head.delivered") : active === 2 ? t("tracking.head.assigned") : active === 1 ? t("tracking.head.offered") : t("tracking.head.pending")}
          </motion.h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-5">
        {/* Same reason as the rider sheets: a plain component inside
            AnimatePresence can be left behind in the DOM after it unmounts,
            and a stale "free cancellation" timer is worse than no animation. */}
        {!isCancelled && !isDelivered && (
          <CancelWindow
            createdAt={order.created_at}
            orderId={order.id}
            onCancelled={() => setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev))}
          />
        )}

        {isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger"
          >
            {order.cancelled_by === "customer"
              ? t("tracking.cancelledByYou")
              : t("tracking.cancelled.body")}
          </motion.div>
        )}

        {!isCancelled && !isDelivered && (order.status === "offered" || order.status === "assigned") && (
          <DeliveryCodeCard code={order.delivery_code} />
        )}

        {isCancelled ? null : rider ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/10 via-surface to-surface p-4"
          >
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan font-display font-bold text-bg"
            >
              {rider.profiles?.name?.charAt(0).toUpperCase() ?? "R"}
            </motion.span>
            <div>
              <p className="text-sm font-semibold">{rider.profiles?.name ?? t("tracking.yourRider")}</p>
              <p className="text-xs text-text-dim">{t("tracking.onTheWay")}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 rounded-2xl border border-amber/20 bg-amber/5 p-4"
          >
            <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-2xl">
              📡
            </motion.span>
            <p className="text-sm text-text-dim">{t("tracking.matching")}</p>
          </motion.div>
        )}

        {rider && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-64 overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/20"
          >
            <RouteMapClient
              orders={[{ id: order.id, lat: order.lat, lng: order.lng, address: order.address, status: order.status, assigned_rider_id: rider.id, sequence_in_route: 0 }]}
              riders={[
                {
                  id: rider.id,
                  depot_lat: rider.depot_lat,
                  depot_lng: rider.depot_lng,
                  name: rider.profiles?.name ?? t("common.rider"),
                  current_lat: rider.current_lat,
                  current_lng: rider.current_lng,
                },
              ]}
              focusOrderId={order.id}
            />
          </motion.div>
        )}

        <div className="relative space-y-6 rounded-2xl border border-border bg-surface/60 p-5 pl-9 backdrop-blur">
          <div className="absolute bottom-6 left-[27px] top-6 w-0.5 overflow-hidden rounded-full bg-border">
            <motion.div
              className="w-full origin-top bg-gradient-to-b from-amber to-success"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: active / 3 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              style={{ height: "100%" }}
            />
          </div>
          {STEPS.map((step, i) => (
            <div key={step.key} className="relative flex items-center gap-3">
              <motion.span
                animate={i === active && !isDelivered ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1.4, repeat: Infinity }}
                className={`absolute -left-9 flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  i <= active ? "bg-success text-bg" : "bg-border text-text-dim"
                }`}
              >
                {i <= active ? step.icon : i + 1}
              </motion.span>
              <div>
                <p className={`text-sm font-semibold ${i > active ? "text-text-dim" : ""}`}>{t(step.labelKey)}</p>
                {stepTimestamps[step.key] && (
                  <p className="text-[11px] text-text-dim">{formatDateTime(stepTimestamps[step.key], lang)}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 font-display text-sm font-semibold">{t("tracking.orderSummary")}</h2>
          {items.map((it, i) => (
            <div key={i} className="mb-1.5 flex justify-between text-sm text-text-dim">
              <span>
                {it.qty}× {it.name}
              </span>
              <span className="text-text">₹{it.price * it.qty}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold">
            <span>{t("cart.total")}</span>
            <span>₹{order.total_amount}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-1 font-display text-sm font-semibold">{t("tracking.deliveringTo")}</h2>
          <p className="text-sm text-text-dim">{order.address}</p>
        </section>

        {isDelivered && (
          <DisputeCard
            orderId={order.id}
            disputeStatus={order.dispute_status}
            onFiled={() =>
              setOrder((prev) => (prev ? { ...prev, dispute_status: "open" } : prev))
            }
          />
        )}

        <SupportSheet orderId={order.id} />
      </main>
    </div>
  );
}
