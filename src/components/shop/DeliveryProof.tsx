"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The customer half of proof-of-delivery: the code to read out at the door,
 * and — if an order was marked delivered that never arrived — the way to say so.
 */
export function DeliveryCodeCard({ code }: { code: string }) {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/10 via-surface to-surface p-4 text-center"
    >
      <p className="text-xs uppercase tracking-wide text-text-dim">{t("tracking.code.title")}</p>
      <p className="my-2 font-mono text-3xl font-bold tracking-[0.35em] text-amber">{code}</p>
      <p className="text-[11px] leading-relaxed text-text-dim">{t("tracking.code.hint")}</p>
    </motion.section>
  );
}

export function DisputeCard({
  orderId,
  disputeStatus,
  onFiled,
}: {
  orderId: string;
  disputeStatus: string | null;
  onFiled: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (disputeStatus) {
    const tone =
      disputeStatus === "resolved"
        ? "border-success/40 bg-success/10 text-success"
        : disputeStatus === "rejected"
          ? "border-border bg-surface-raised text-text-dim"
          : "border-amber/40 bg-amber/10 text-amber";
    return (
      <section className={`rounded-2xl border p-4 text-sm ${tone}`}>
        {t(`tracking.dispute.status.${disputeStatus}`)}
      </section>
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);
      setOpen(false);
      onFiled();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.err.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-1 font-display text-sm font-semibold">{t("tracking.dispute.title")}</h2>
      <p className="mb-3 text-xs leading-relaxed text-text-dim">{t("tracking.dispute.body")}</p>

      {/* No animation wrapper at all. An AnimatePresence swap here left the
          form stuck at height 0 / opacity 0 — laid out and readable to the DOM,
          but invisible and unclickable. Controls a customer needs in order to
          report a problem must not depend on an animation having completed. */}
      {open ? (
        <div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("tracking.dispute.placeholder")}
            className="mb-2 w-full resize-none rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-danger"
          />
          {error && <p className="mb-2 text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || reason.trim().length < 3}
              className="flex-1 rounded-xl bg-danger py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {submitting ? t("tracking.dispute.sending") : t("tracking.dispute.send")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-xs text-text-dim"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-danger/40 py-2.5 text-xs font-semibold text-danger"
        >
          {t("tracking.dispute.cta")}
        </button>
      )}
    </section>
  );
}
