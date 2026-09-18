"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

export const CANCEL_WINDOW_MS = 3 * 60 * 1000;

/**
 * Free-cancellation window. Mirrors the 3-minute guard enforced inside
 * `cancel_my_order` — the countdown here is the UI half of that rule, and the
 * database still rejects a late request even if this component is bypassed.
 */
export function CancelWindow({
  createdAt,
  orderId,
  onCancelled,
}: {
  createdAt: string;
  orderId: string;
  onCancelled: () => void;
}) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(createdAt).getTime() + CANCEL_WINDOW_MS;
  const remainingMs = Math.max(0, deadline - now);
  const expired = remainingMs <= 0;

  useEffect(() => {
    if (expired) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [expired]);

  // Long enough that a moment's hesitation doesn't silently re-arm the button
  // instead of confirming — a 4s window made the second tap land on a reset
  // control and quietly do nothing.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 12000);
    return () => clearTimeout(id);
  }, [confirming]);

  if (expired) return null;

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const timeLabel = `${mm}:${ss.toString().padStart(2, "0")}`;
  const progress = remainingMs / CANCEL_WINDOW_MS;

  async function cancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tracking.cancelFailed"));
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-2xl border border-amber/40 bg-amber/5 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber">
            {t("tracking.cancelWindow", { time: timeLabel })}
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-amber/20">
            <motion.div
              className="h-full rounded-full bg-amber"
              animate={{ width: `${progress * 100}%` }}
              transition={{ ease: "linear", duration: 0.5 }}
            />
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={cancel}
          disabled={cancelling}
          className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
            confirming
              ? "bg-danger text-white"
              : "border border-danger/40 text-danger hover:bg-danger/10"
          }`}
        >
          {cancelling
            ? t("tracking.cancelling")
            : confirming
              ? t("tracking.cancelConfirm")
              : t("tracking.cancelBtn")}
        </motion.button>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            key="cancel-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-xs text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
