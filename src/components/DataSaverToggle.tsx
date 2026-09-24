"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDataSaver } from "@/components/DataSaverProvider";
import { useLanguage } from "@/components/LanguageProvider";
import type { SaverMode } from "@/lib/dataSaver";

function LeafIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

/**
 * The Data Saver switch: a round button beside the theme toggle, lit lime
 * while the light version is on. It opens three choices - automatic (the
 * default), always on, always off - and says what the connection looks like.
 */
export function DataSaverToggle({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { on, mode, slow, setMode } = useDataSaver();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const options: { value: SaverMode; label: string; hint: string }[] = [
    { value: "auto", label: t("saver.auto"), hint: t("saver.autoHint") },
    { value: "on", label: t("saver.on"), hint: t("saver.onHint") },
    { value: "off", label: t("saver.off"), hint: t("saver.offHint") },
  ];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("saver.title")}
        aria-expanded={open}
        title={t("saver.title")}
        className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 transition-colors ${
          on ? "bg-lime text-ink ring-lime" : "bg-surface/80 text-text-dim ring-border hover:text-text"
        }`}
      >
        <LeafIcon />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="saver-panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 top-[calc(var(--safe-top)+4rem)] z-[1600] rounded-3xl bg-surface p-2 text-text shadow-2xl shadow-black/30 ring-1 ring-border sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80"
          >
            <div className="px-3 pb-2 pt-2.5">
              <p className="text-sm font-semibold">{t("saver.title")}</p>
              <p className="mt-0.5 text-xs text-text-dim">{t("saver.explain")}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-text-dim">
                <span className={`h-1.5 w-1.5 rounded-full ${slow ? "bg-[#f5a524]" : "bg-success"}`} />
                {slow ? t("saver.netSlow") : t("saver.netFast")}
              </p>
            </div>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setMode(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  mode === o.value ? "bg-brand/10" : "hover:bg-surface-raised"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ${
                    mode === o.value ? "ring-brand" : "ring-border"
                  }`}
                >
                  {mode === o.value && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-text-dim">{o.hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A one-time note when Data Saver switches itself on, so nobody wonders why
 * the photographs are gone - with a way straight out.
 */
export function DataSaverNotice() {
  const { t } = useLanguage();
  const { on, mode, setMode } = useDataSaver();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from session storage after mount
      setDismissed(sessionStorage.getItem("saver-notice") === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem("saver-notice", "1");
    } catch {
      // fine: it just may show again
    }
  }

  const show = on && mode === "auto" && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="saver-notice"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-[1450] mx-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-2 text-white shadow-2xl ring-1 ring-white/10"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
            <LeafIcon />
          </span>
          <p className="min-w-0 flex-1 text-xs leading-snug">{t("saver.notice")}</p>
          <button
            type="button"
            onClick={() => {
              setMode("off");
              dismiss();
            }}
            className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium"
          >
            {t("saver.turnOff")}
          </button>
          <button type="button" onClick={dismiss} aria-label={t("common.close")} className="shrink-0 px-1.5 text-white/60">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
