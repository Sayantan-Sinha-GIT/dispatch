"use client";

import { useLanguage } from "@/components/LanguageProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "hi" : "en")}
      aria-label={t("a11y.toggleLanguage")}
      className={`flex h-9 items-center justify-center rounded-lg border border-border bg-surface-raised px-2.5 text-xs font-bold text-text-dim transition-colors hover:text-text ${className}`}
    >
      {lang === "en" ? "हिं" : "EN"}
    </button>
  );
}
