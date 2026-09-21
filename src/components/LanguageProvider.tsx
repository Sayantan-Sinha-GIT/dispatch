"use client";

import { createContext, useContext, useEffect } from "react";
import { LANG_EVENT, useStoredLang } from "@/lib/browserState";
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
  const lang: Lang = useStoredLang();

  // Keep <html lang> honest for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(l: Lang) {
    try {
      localStorage.setItem("lang", l);
    } catch {
      // Private mode or blocked storage: nothing persists, and the toggle
      // cannot take effect either, since the stored value is the source.
    }
    window.dispatchEvent(new Event(LANG_EVENT));
  }

  const t: TFunction = (key, params) => translate(lang, key, params);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
