"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { addToCart, cartCount, cartSubtotal, getCart, type CartItem } from "@/lib/cart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Product = Tables<"products">;

export default function ShopCatalogPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Product | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name")
      .then(({ data }) => setProducts(data ?? []));

    setCart(getCart());
    const onUpdate = () => setCart(getCart());
    window.addEventListener("cart-updated", onUpdate);
    return () => window.removeEventListener("cart-updated", onUpdate);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login?role=customer");
    router.refresh();
  }

  const categories = useMemo(() => ["All", ...new Set(products.map((p) => p.category))], [products]);
  const filtered = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (query.trim() === "" || p.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart);
  const loading = products.length === 0;

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-gradient-to-r from-surface via-surface to-amber/10 px-6 py-5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-amber/60 font-display font-bold text-bg">
              D
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">{t("shop.title")}</h1>
              <p className="text-xs text-text-dim">{t("shop.tagline")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle className="hidden sm:flex" />
            <ThemeToggle className="hidden sm:flex" />
            <Link
              href="/shop/orders"
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-dim transition-colors hover:border-amber/50 hover:text-text"
            >
              {t("shop.myOrders")}
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-dim transition-colors hover:border-amber/50 hover:text-text"
            >
              {t("shop.signOut")}
            </button>
          </div>
        </div>

        <div className="relative mt-4">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("shop.searchPlaceholder")}
            className="w-full rounded-xl border border-border bg-surface-raised py-2.5 pl-10 pr-3.5 text-sm outline-none transition-colors focus:border-amber"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                category === c ? "bg-amber text-bg" : "border border-border bg-surface-raised text-text-dim hover:text-text"
              }`}
            >
              {c === "All" ? t("shop.all") : c}
            </button>
          ))}
        </div>
      </header>

      <main className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-surface p-3.5">
                <div className="mb-2.5 h-20 w-full rounded-xl bg-surface-raised" />
                <div className="mb-2 h-3.5 w-3/4 rounded bg-surface-raised" />
                <div className="h-3 w-1/2 rounded bg-surface-raised" />
              </div>
            ))
          : filtered.map((p) => {
              const inCart = cart.find((c) => c.productId === p.id);
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => setViewing(p)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  className={`rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-amber/30 ${!p.in_stock ? "opacity-50" : ""}`}
                >
                  <div className={`mb-2.5 h-20 w-full overflow-hidden rounded-xl bg-gradient-to-br ${p.image_gradient}`}>
                    <motion.div whileHover={{ scale: 1.08 }} className="h-full w-full" />
                  </div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="mb-2 text-xs text-text-dim">
                    {p.category} · {p.unit}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold">₹{p.price}</span>
                    {p.in_stock ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart({ productId: p.id, name: p.name, price: p.price, unit: p.unit });
                        }}
                        className="rounded-lg bg-amber/15 px-2.5 py-1 text-xs font-bold text-amber transition-colors hover:bg-amber/25"
                      >
                        {inCart ? `+ (${inCart.qty})` : t("shop.add")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">
                        {t("shop.outOfStock")}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
        {!loading && filtered.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-text-dim">{t("shop.noMatch", { query })}</p>
        )}
      </main>

      <AnimatePresence>
        {count > 0 && (
          <motion.div
            key="cart-bar"
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur"
          >
            <Link
              href="/shop/cart"
              className="mx-auto flex max-w-lg items-center justify-between rounded-xl bg-amber px-5 py-3.5 font-semibold text-bg"
            >
              <span>
                {count} {t("shop.itemsInCart")}
              </span>
              <span>
                {t("shop.viewCart")} · ₹{subtotal.toFixed(0)} →
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <motion.div
            key="product-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewing(null)}
            className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-border bg-surface sm:rounded-3xl"
            >
              <div className={`relative h-48 w-full bg-gradient-to-br ${viewing.image_gradient}`}>
                <button
                  onClick={() => setViewing(null)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
                >
                  ✕
                </button>
                {!viewing.in_stock && (
                  <span className="absolute left-3 top-3 rounded-full bg-danger px-2.5 py-1 text-[10px] font-bold uppercase text-white">
                    {t("shop.outOfStock")}
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-wide text-text-dim">
                  {viewing.category} · {viewing.unit}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">{viewing.name}</h2>
                <p className="mt-1 font-display text-lg font-bold text-amber">₹{viewing.price}</p>

                <div className="mt-4 rounded-xl border border-border bg-surface-raised p-3.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{t("shop.productDetails")}</p>
                  <p className="text-sm text-text-dim">{t("shop.noInfo")}</p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={!viewing.in_stock}
                  onClick={() => {
                    addToCart({ productId: viewing.id, name: viewing.name, price: viewing.price, unit: viewing.unit });
                    setViewing(null);
                  }}
                  className="mt-5 w-full rounded-xl bg-amber py-3 text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {t("shop.addToCart")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
