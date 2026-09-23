"use client";

import { useLanguage } from "@/components/LanguageProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "hi" : "en")}
      aria-label={t("a11y.toggleLanguage")}
      className={`flex h-9 min-w-9 items-center justify-center rounded-full bg-surface/80 px-2.5 text-xs font-semibold text-text-dim ring-1 ring-border backdrop-blur transition-colors hover:text-text ${className}`}
    >
      {lang === "en" ? "हिं" : "EN"}
    </button>
  );
}
