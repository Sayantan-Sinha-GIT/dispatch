"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dictionary, type Lang } from "@/lib/i18n";

export type TParams = Record<string, string | number>;
/**
 * Keys are `string` rather than a literal union so dynamic lookups like
 * `t(\`status.${order.status}\`)` typecheck. Missing keys fall back to English,
 * then to the key itself, so a gap degrades to readable text instead of blank UI.
 */
export type TFunction = (key: string, params?: TParams) => string;

function interpolate(template: string, params?: TParams) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function translate(lang: Lang, key: string, params?: TParams) {
  const table = dictionary[lang] as Record<string, string>;
  const fallback = dictionary.en as Record<string, string>;
  const template = table[key] ?? fallback[key] ?? key;
  return interpolate(template, params);
}

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunction;
}>({
  lang: "en",
  setLang: () => {},
  t: (key, params) => translate("en", key, params),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("lang") as Lang | null;
    if (stored === "en" || stored === "hi") setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
      document.documentElement.lang = l;
    } catch {
      // private mode / blocked storage — the toggle still works for this session
    }
  }

  const t: TFunction = (key, params) => translate(lang, key, params);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
