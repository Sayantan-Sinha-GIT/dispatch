"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Proof of delivery. The customer is shown a four-digit code the moment a rider
 * is assigned; the rider has to read it off the customer's screen to close the
 * job.
 *
 * This is what stops "marked delivered" from being a claim a rider can make
 * unilaterally — the whole reason a customer needed a way to dispute one.
 */
export function DeliverConfirm({
  address,
  onConfirm,
  onCancel,
  submitting,
  error,
}: {
  address: string;
  onConfirm: (code: string) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-1 font-display text-lg font-semibold">{t("rider.deliver.title")}</h2>
        <p className="mb-1 truncate text-xs text-text-dim">{address}</p>
        <p className="mb-5 text-xs leading-relaxed text-text-dim">{t("rider.deliver.hint")}</p>

        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="————"
          className="mb-4 w-full rounded-xl border border-border bg-surface-raised px-3 py-3.5 text-center font-mono text-2xl tracking-[0.5em] outline-none transition-colors focus:border-success"
        />

        {error && (
          <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          disabled={code.length < 4 || submitting}
          onClick={() => onConfirm(code)}
          className="w-full rounded-xl bg-success py-3 text-sm font-bold text-bg disabled:opacity-50"
        >
          {submitting ? t("rider.deliver.confirming") : t("rider.deliver.confirm")}
        </motion.button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full py-2 text-center text-xs text-text-dim hover:text-text"
        >
          {t("common.cancel")}
        </button>
      </motion.div>
    </motion.div>
  );
}
