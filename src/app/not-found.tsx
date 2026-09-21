"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { PageBackground } from "@/components/PageBackground";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Shown for any path that does not exist. Before this, a signed-out visitor
 * who mistyped a URL was sent to the sign-in form, which reads as being
 * logged out rather than as a wrong address.
 */
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <PageBackground accent="both" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-w-md flex-col items-center text-center"
      >
        <p
          aria-hidden
          className="font-display text-[7rem] font-bold leading-none tracking-tighter text-transparent [-webkit-text-stroke:1.5px_var(--amber)] sm:text-[9rem]"
        >
          404
        </p>
        <Image src="/images/empty/no-results.webp" alt="" width={120} height={120} className="-mt-6 opacity-80" />

        {/* The route that goes nowhere: a dashed path ending in an open stop. */}
        <svg className="mt-4 h-10 w-56" viewBox="0 0 224 40" aria-hidden>
          <circle cx="8" cy="30" r="5" fill="var(--amber)" />
          <motion.path
            d="M 14 30 C 60 30, 70 8, 116 12 S 180 34, 208 14"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="2"
            strokeDasharray="5 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeInOut", delay: 0.2 }}
          />
          <circle cx="214" cy="12" r="5" fill="none" stroke="var(--text-dim)" strokeWidth="2" />
        </svg>

        <h1 className="mt-5 font-display text-2xl font-semibold">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-text-dim">{t("notFound.body")}</p>
        <Link
          href="/"
          className="mt-7 rounded-full bg-amber px-7 py-3 text-sm font-bold text-bg shadow-lg shadow-amber/25 transition-transform hover:scale-[1.04] active:scale-95"
        >
          {t("notFound.home")}
        </Link>
      </motion.div>
    </div>
  );
}
