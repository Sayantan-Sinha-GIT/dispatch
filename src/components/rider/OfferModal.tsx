"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { PAYOUT_BASE, PAYOUT_PER_KG, PAYOUT_PER_KM } from "@/lib/pricing";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;

const OFFER_WINDOW_MS = 5 * 60 * 1000;

/**
 * The offer popup a rider sees the instant work is assigned to them. It leads
 * with the two numbers that decide whether they take the job — what they earn
 * and how far they ride — because that is the whole decision.
 */
export function OfferModal({
  order,
  now,
  onAccept,
  onDecline,
  accepting,
  declining,
  queuedCount,
}: {
  order: Order;
  now: number;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  declining: boolean;
  queuedCount: number;
}) {
  const { t } = useLanguage();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const offeredAt = order.offered_at ? new Date(order.offered_at).getTime() : now;
  const remainingMs = Math.max(0, offeredAt + OFFER_WINDOW_MS - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const progress = Math.max(0, Math.min(1, remainingMs / OFFER_WINDOW_MS));
  const urgent = remainingMs < 60_000;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  const payout = Number(order.payout_amount ?? 0);
  const distanceKm = Number(order.payout_distance_km ?? 0);
  const weightComponent = Math.round(order.weight * PAYOUT_PER_KG);
  const distanceComponent = Math.round(distanceKm * PAYOUT_PER_KM);
  const busy = accepting || declining;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border-2 border-amber bg-surface shadow-2xl shadow-amber/20 sm:rounded-3xl"
      >
        {/* pulsing accent rail */}
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="h-1 w-full bg-gradient-to-r from-amber via-amber/40 to-amber"
        />

        <div className="p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber">
                {t("rider.offer.title")}
              </p>
              {queuedCount > 0 && (
                <p className="mt-0.5 text-[11px] text-text-dim">+{queuedCount} more waiting</p>
              )}
            </div>

            <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
              <svg width="76" height="76" className="-rotate-90">
                <circle cx="38" cy="38" r={radius} stroke="var(--border)" strokeWidth="5" fill="none" />
                <motion.circle
                  cx="38"
                  cy="38"
                  r={radius}
                  stroke={urgent ? "var(--danger)" : "var(--amber)"}
                  strokeWidth="5"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                />
              </svg>
              <motion.span
                animate={urgent ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
                className={`absolute font-mono text-sm font-bold ${urgent ? "text-danger" : "text-amber"}`}
              >
                {timeLabel}
              </motion.span>
            </div>
          </div>

          {/* The decision numbers */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.06 }}
              className="rounded-2xl border border-success/40 bg-success/10 p-3.5"
            >
              <p className="text-[10px] uppercase tracking-wide text-text-dim">
                {t("rider.offer.payout")}
              </p>
              <p className="font-display text-3xl font-bold text-success">₹{payout}</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl border border-cyan/40 bg-cyan/10 p-3.5"
            >
              <p className="text-[10px] uppercase tracking-wide text-text-dim">
                {t("rider.offer.distance")}
              </p>
              <p className="font-display text-3xl font-bold text-cyan">
                {distanceKm}
                <span className="ml-1 text-base font-semibold">{t("common.km")}</span>
              </p>
            </motion.div>
          </div>

          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="mt-2.5 w-full text-left text-[11px] text-text-dim underline-offset-2 hover:underline"
          >
            {t("rider.offer.breakdown")} {showBreakdown ? "▴" : "▾"}
          </button>
          <AnimatePresence>
            {showBreakdown && (
              <motion.div
                key="payout-breakdown"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1 rounded-xl bg-surface-raised p-3 text-xs">
                  <Row label={t("rider.offer.base")} value={`₹${PAYOUT_BASE}`} />
                  <Row
                    label={t("rider.offer.perKg", { weight: order.weight })}
                    value={`₹${weightComponent}`}
                    hint={`₹${PAYOUT_PER_KG}/${t("common.kg")}`}
                  />
                  <Row
                    label={t("rider.offer.perKm", { distance: distanceKm })}
                    value={`₹${distanceComponent}`}
                    hint={`₹${PAYOUT_PER_KM}/${t("common.km")}`}
                  />
                  <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold text-text">
                    <span>{t("rider.offer.payout")}</span>
                    <span className="text-success">₹{payout}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 rounded-2xl bg-surface-raised p-3.5">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">
              {t("rider.offer.dropAt")}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug">{order.address}</p>
            <p className="mt-1 text-xs text-text-dim">
              {order.weight} {t("common.kg")}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-border bg-surface-raised/60 p-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onDecline}
            disabled={busy}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-text-dim transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50"
          >
            {declining ? t("rider.offer.declining") : t("rider.offer.decline")}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onAccept}
            disabled={busy}
            className="flex-[2] rounded-xl bg-amber px-4 py-3.5 font-display text-base font-bold text-bg shadow-lg shadow-amber/25 disabled:opacity-60"
          >
            {accepting ? t("rider.offer.accepting") : `${t("rider.offer.accept")} · ₹${payout}`}
          </motion.button>
        </div>

        <p className="pb-4 text-center text-[10px] text-text-dim">{t("rider.offer.declineNote")}</p>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between text-text-dim">
      <span>
        {label}
        {hint && <span className="ml-1 text-[10px] opacity-70">({hint})</span>}
      </span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}
