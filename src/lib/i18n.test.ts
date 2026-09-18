import { describe, expect, it } from "vitest";
import { dictionary } from "./i18n";

/**
 * The previous "language leak" class of bug was a key present in `en` but not
 * `hi` (or vice versa) — invisible in review, and it silently falls back to
 * English at runtime. These tests fail the build instead.
 */
describe("i18n dictionary", () => {
  const enKeys = Object.keys(dictionary.en).sort();
  const hiKeys = Object.keys(dictionary.hi).sort();

  it("has identical key sets across locales", () => {
    const missingInHi = enKeys.filter((k) => !(k in dictionary.hi));
    const missingInEn = hiKeys.filter((k) => !(k in dictionary.en));
    expect({ missingInHi, missingInEn }).toEqual({ missingInHi: [], missingInEn: [] });
  });

  it("has no empty translations", () => {
    const empties: string[] = [];
    for (const [locale, table] of Object.entries(dictionary)) {
      for (const [key, value] of Object.entries(table as Record<string, string>)) {
        if (!value || !value.trim()) empties.push(`${locale}.${key}`);
      }
    }
    expect(empties).toEqual([]);
  });

  it("keeps interpolation placeholders consistent between locales", () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
    const mismatched = enKeys.filter(
      (k) =>
        placeholders((dictionary.en as Record<string, string>)[k]) !==
        placeholders((dictionary.hi as Record<string, string>)[k]),
    );
    expect(mismatched).toEqual([]);
  });

  it("covers every order status rendered by the UI", () => {
    for (const status of ["pending", "offered", "assigned", "delivered", "expired", "failed", "cancelled"]) {
      expect(dictionary.en).toHaveProperty(`status.${status}`);
      expect(dictionary.hi).toHaveProperty(`status.${status}`);
    }
  });
});
