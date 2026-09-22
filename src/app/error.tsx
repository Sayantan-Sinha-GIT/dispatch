"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageBackground } from "@/components/PageBackground";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Catches a crash anywhere below the root layout. Without it, a page that
 * throws while rendering is replaced by Next's bare error text on the dark
 * background, which reads as an empty black screen.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <PageBackground accent="both" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="surface-raised-soft relative flex max-w-md flex-col items-center rounded-3xl p-8 text-center ring-1 ring-border/70"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/15 font-display text-2xl font-bold text-danger">
          !
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold">{t("error.title")}</h1>
        <p className="mt-2 text-sm text-text-dim">{t("error.body")}</p>
        {error.digest && <p className="mt-3 font-mono text-[11px] text-text-dim/70">{error.digest}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => retry()}
            className="rounded-full bg-amber px-7 py-3 text-sm font-bold text-bg shadow-lg shadow-amber/25 transition-transform hover:scale-[1.04] active:scale-95"
          >
            {t("error.retry")}
          </button>
          <Link
            href="/"
            className="rounded-full px-6 py-3 text-sm font-semibold text-text-dim ring-1 ring-border transition-colors hover:text-text"
          >
            {t("notFound.home")}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
