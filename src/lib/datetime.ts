import type { Lang } from "@/lib/i18n";

const LOCALES: Record<Lang, string> = { en: "en-IN", hi: "hi-IN" };

/**
 * Order timestamps are rendered in the viewer's language but always with both
 * the date and the time — "19 Sep" alone is useless for telling two of today's
 * orders apart, which is exactly what an order list is for.
 */
export function formatDateTime(value: string | null | undefined, lang: Lang = "en") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(LOCALES[lang] ?? "en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Time only, for a same-day event where the date is already obvious. */
export function formatTime(value: string | null | undefined, lang: Lang = "en") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(LOCALES[lang] ?? "en-IN", { hour: "2-digit", minute: "2-digit" });
}
