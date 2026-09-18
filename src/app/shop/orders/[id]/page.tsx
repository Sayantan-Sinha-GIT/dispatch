"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { RouteMapClient } from "@/components/RouteMapClient";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Rider = Tables<"riders"> & { profiles?: { name: string } | null };
type Order = Tables<"orders"> & { riders?: Rider | null };

const STEPS = [
  { key: "placed", label: "Order placed", icon: "🧾" },
  { key: "offered", label: "Rider notified", icon: "📡" },
  { key: "assigned", label: "Out for delivery", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "🎉" },
];

function stepIndex(status: string) {
  if (status === "delivered") return 3;
  if (status === "assigned") return 2;
  if (status === "offered" || status === "expired") return 1;
  return 0;
}

const CONFETTI = ["🎉", "✨", "🎊", "⭐", "💛"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        emoji: CONFETTI[i % CONFETTI.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.2,
        drift: (Math.random() - 0.5) * 120,
      })),
    [],
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

function AmbientBackground({ accent }: { accent: "amber" | "cyan" | "success" }) {
  const color = accent === "success" ? "rgba(61,220,151,0.16)" : accent === "cyan" ? "rgba(45,212,196,0.14)" : "rgba(255,176,32,0.16)";
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <motion.div
        className="absolute -left-40 top-0 h-96 w-96 rounded-full blur-[110px]"
        style={{ background: color }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan/10 blur-[110px]"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export default function ShopOrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [justDelivered, setJustDelivered] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const load = () =>
      supabase
        .from("orders")
        .select("*, riders(*, profiles(name))")
        .eq("id", id)
        .single()
        .then(({ data }) => {
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
  }, [id]);

  if (!order) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg text-sm text-text-dim">
        <AmbientBackground accent="cyan" />
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="mr-2 text-lg">
          🛵
        </motion.span>
        Loading your order…
      </div>
    );
  }

  const active = stepIndex(order.status);
  const isDelivered = order.status === "delivered";
  const accent: "amber" | "cyan" | "success" = isDelivered ? "success" : active >= 2 ? "cyan" : "amber";
  const items = Array.isArray(order.items) ? (order.items as { name: string; qty: number; price: number }[]) : [];
  const rider = order.riders ?? null;

  return (
    <div className="relative min-h-screen pb-10">
      <AmbientBackground accent={accent} />
      <AnimatePresence>{justDelivered && <Confetti />}</AnimatePresence>

      <header className="flex items-center gap-3.5 border-b border-border/60 px-5 py-5 backdrop-blur-sm">
        <Link href="/shop/orders" className="text-text">
          ←
        </Link>
        <div>
          <p className="text-[11px] text-text-dim">Order #{order.id.slice(0, 8)}</p>
          <motion.h1
            key={order.status}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-lg font-semibold"
          >
            {isDelivered ? "Delivered 🎉" : active === 2 ? "Out for delivery" : active === 1 ? "Rider on the way to accept" : "Finding your rider…"}
          </motion.h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-5">
        {rider ? (
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
              <p className="text-sm font-semibold">{rider.profiles?.name ?? "Your rider"}</p>
              <p className="text-xs text-text-dim">On the way to you</p>
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
            <p className="text-sm text-text-dim">Matching you with the nearest available rider…</p>
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
                  name: rider.profiles?.name ?? "Rider",
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
              <p className={`text-sm font-semibold ${i > active ? "text-text-dim" : ""}`}>{step.label}</p>
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
      </main>
    </div>
  );
}
