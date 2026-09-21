"use client";

import { useEffect, useMemo, useState } from "react";
import { PageBackground } from "@/components/PageBackground";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { addToCart, cartCount, cartSubtotal } from "@/lib/cart";
import { useCart } from "@/lib/browserState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";
import { ProductImage } from "@/components/shop/ProductImage";
import Image from "next/image";

/** Lower-case slug per category, matching the delivered artwork. */
const CATEGORY_IMAGE: Record<string, string> = {
  Bakery: "/images/categories/bakery.webp",
  Beverages: "/images/categories/beverages.webp",
  Dairy: "/images/categories/dairy.webp",
  Produce: "/images/categories/produce.webp",
  Snacks: "/images/categories/snacks.webp",
  Staples: "/images/categories/staples.webp",
};

type Product = Tables<"products">;

export default function ShopCatalogPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const cart = useCart();
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
    <div className="relative min-h-screen pb-28">
      <PageBackground accent="amber" grid={false} />
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

        <div className="-mx-4 mt-3.5 flex gap-2.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c, i) => {
            const img = CATEGORY_IMAGE[c];
            const active = category === c;
            return (
              <motion.button
                key={c}
                onClick={() => setCategory(c)}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 220, damping: 24 }}
                whileTap={{ scale: 0.95 }}
                className={`group relative h-16 w-28 shrink-0 overflow-hidden rounded-2xl text-left ring-1 transition-all duration-300 ${
                  active ? "ring-2 ring-amber" : "ring-border/70 hover:ring-amber/50"
                }`}
              >
                {img ? (
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="112px"
                    className={`object-cover transition-transform duration-500 group-hover:scale-110 ${
                      active ? "scale-105" : ""
                    }`}
                  />
                ) : (
                  /* "All" has no photograph of its own, so it shows four of the
                     others as a mosaic - it reads as "everything" and keeps the
                     row even. The old colour wash looked like an empty slot. */
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-black">
                    {Object.values(CATEGORY_IMAGE)
                      .slice(0, 4)
                      .map((src) => (
                        <div key={src} className="relative">
                          <Image
                            src={src}
                            alt=""
                            fill
                            sizes="56px"
                            className={`object-cover transition-transform duration-500 group-hover:scale-110 ${
                              active ? "scale-105" : ""
                            }`}
                          />
                        </div>
                      ))}
                  </div>
                )}
                <div className={`absolute inset-0 transition-colors ${active ? "bg-black/35" : "bg-black/55 group-hover:bg-black/40"}`} />
                <span
                  className={`absolute bottom-2 left-2.5 text-xs font-bold drop-shadow-lg transition-colors ${
                    active ? "text-amber" : "text-white"
                  }`}
                >
                  {c === "All" ? t("shop.all") : c}
                </span>
              </motion.button>
            );
          })}
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
          : filtered.map((p, i) => {
              const inCart = cart.find((c) => c.productId === p.id);
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => setViewing(p)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  /* Capped so a long catalogue does not leave the last row
                     waiting seconds to appear. */
                  transition={{ delay: Math.min(i * 0.035, 0.45), type: "spring", stiffness: 190, damping: 24 }}
                  whileHover={{ y: -6 }}
                  className={`group relative overflow-hidden rounded-3xl bg-surface text-left shadow-lg shadow-black/25 ring-1 ring-border/70 transition-[box-shadow,transform] duration-300 hover:shadow-xl hover:shadow-amber/10 hover:ring-amber/40 ${!p.in_stock ? "opacity-55" : ""}`}
                >
                  <ProductImage
                    src={p.image_url}
                    gradient={p.image_gradient}
                    alt={p.name}
                    /* Two columns on a phone, four on a wide screen - tells the
                       browser to fetch a ~50vw file on mobile, not a full one. */
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="aspect-square w-full"
                  />

                  {inCart && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      className="absolute right-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-amber px-1.5 font-display text-xs font-bold text-bg shadow-lg"
                    >
                      {inCart.qty}
                    </motion.span>
                  )}

                  <div className="p-3.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="mb-2.5 truncate text-xs text-text-dim">
                      {p.category} · {p.unit}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-bold">₹{p.price}</span>
                      {p.in_stock ? (
                        <motion.span
                          role="button"
                          tabIndex={0}
                          whileTap={{ scale: 0.88 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({ productId: p.id, name: p.name, price: p.price, unit: p.unit });
                          }}
                          className="rounded-full bg-amber/15 px-3 py-1.5 text-xs font-bold text-amber transition-colors hover:bg-amber hover:text-bg"
                        >
                          {inCart ? `+ (${inCart.qty})` : t("shop.add")}
                        </motion.span>
                      ) : (
                        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">
                          {t("shop.outOfStock")}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-full flex flex-col items-center py-16"
          >
            <Image src="/images/empty/no-results.webp" alt="" width={140} height={140} className="mb-4 opacity-70" />
            <p className="text-center text-sm text-text-dim">{t("shop.noMatch", { query })}</p>
          </motion.div>
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
              <div className="relative aspect-[4/3] w-full">
                <ProductImage
                  src={viewing.image_url}
                  gradient={viewing.image_gradient}
                  alt={viewing.name}
                  sizes="(max-width: 640px) 100vw, 480px"
                  priority
                  zoomOnHover={false}
                  className="h-full w-full"
                />
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
