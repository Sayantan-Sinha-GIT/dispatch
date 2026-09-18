"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

/** Lets a customer raise a support request against a specific order. */
export function SupportSheet({ orderId }: { orderId?: string | null }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, orderId: orderId ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.err.generic"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
        className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm text-text-dim backdrop-blur transition-colors hover:border-cyan/40 hover:text-text"
      >
        💬 {t("tracking.needHelp")}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="support-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border border-border bg-surface p-5 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{t("tracking.supportTitle")}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-1 text-sm text-text-dim hover:text-text"
                >
                  ✕
                </button>
              </div>

              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border border-success/40 bg-success/10 p-5 text-center"
                >
                  <p className="mb-1 text-3xl">✅</p>
                  <p className="text-sm text-success">{t("tracking.supportSent")}</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-3 rounded-lg bg-surface-raised px-4 py-2 text-xs text-text-dim"
                  >
                    {t("common.close")}
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  {error && (
                    <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
                  )}
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("tracking.supportSubject")}
                    className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-cyan"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("tracking.supportMessage")}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-cyan"
                  />
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={sending || !subject.trim() || !message.trim()}
                    className="w-full rounded-xl bg-cyan py-3 text-sm font-semibold text-bg disabled:opacity-50"
                  >
                    {sending ? t("tracking.supportSending") : t("tracking.supportSend")}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
