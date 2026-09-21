"use client";

import { useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart";

/*
 * State that lives in the browser — the cart, the language, the theme — used
 * to be copied into React state by an effect after mount. That renders twice,
 * and the React compiler rejects it outright ("setState synchronously within
 * an effect"). `useSyncExternalStore` is the hook built for exactly this: it
 * reads the browser value directly, subscribes to changes, and gives the
 * server a fixed value so hydration still matches.
 */

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage: behave as if nothing was stored.
    return null;
  }
}

function listen(events: string[]) {
  return (onChange: () => void) => {
    for (const e of events) window.addEventListener(e, onChange);
    return () => {
      for (const e of events) window.removeEventListener(e, onChange);
    };
  };
}

/* ---- cart ---------------------------------------------------------------- */

const CART_KEY = "dispatch_shop_cart";
const EMPTY_CART: CartItem[] = [];
let cartRaw: string | null = null;
let cartValue: CartItem[] = EMPTY_CART;

// The snapshot must be the same object until the cart actually changes, or
// React re-renders forever. Parse only when the stored string differs.
function cartSnapshot(): CartItem[] {
  const raw = readStorage(CART_KEY) ?? "[]";
  if (raw !== cartRaw) {
    cartRaw = raw;
    try {
      cartValue = JSON.parse(raw);
    } catch {
      cartValue = EMPTY_CART;
    }
  }
  return cartValue;
}

const subscribeCart = listen(["cart-updated", "storage"]);

/** The customer's cart, live across tabs and components. */
export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribeCart, cartSnapshot, () => EMPTY_CART);
}

/* ---- language ------------------------------------------------------------ */

export type StoredLang = "en" | "hi";
export const LANG_EVENT = "lang-changed";
const subscribeLang = listen([LANG_EVENT, "storage"]);

function langSnapshot(): StoredLang {
  return readStorage("lang") === "hi" ? "hi" : "en";
}

export function useStoredLang(): StoredLang {
  return useSyncExternalStore(subscribeLang, langSnapshot, () => "en");
}

/* ---- theme --------------------------------------------------------------- */

// The boot script in the root layout sets `data-theme` before first paint, so
// the attribute — not localStorage — is the source of truth for what is shown.
function themeSnapshot(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useThemeName(): "dark" | "light" {
  return useSyncExternalStore(subscribeTheme, themeSnapshot, () => "dark");
}
