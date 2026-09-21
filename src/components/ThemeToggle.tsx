"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { useThemeName } from "@/lib/browserState";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const theme = useThemeName();

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Blocked storage: the switch still applies for this visit.
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      aria-label={t("a11y.toggleTheme")}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-dim transition-colors hover:text-text ${className}`}
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </motion.button>
  );
}
