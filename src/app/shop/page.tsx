"use client";

import { useEffect, useMemo, useState } from "react";
import { PageBackground } from "@/components/PageBackground";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { addToCart, cartCount, cartSubtotal } from "@/lib/cart";
import { useCart } from "@/lib/browserState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { SignOutButton } from "@/components/SignOutButton";
import { PortalBar, barPill } from "@/components/PortalBar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";
import { ProductImage } from "@/components/shop/ProductImage";
import Image from "next/image";
import { LOW_STOCK } from "@/lib/stock";

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
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const cart = useCart();
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Product | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let live = true;
    const load = () =>
      supabase
        .from("products")
        .select("*")
        .eq("is_listed", true)
        .order("category")
        .order("name")
        .then(({ data }) => {
          if (!live) return;
          setProducts(data ?? []);
          setLoaded(true);
        });
    load();
    supabase.auth.getUser().then(({ data }) => live && setProfileId(data.user?.id ?? null));

    // Other people's orders take stock; show what is actually left.
    const channel = supabase
      .channel("shop-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // The open detail sheet follows the live row, so its stock stays current.
  const viewingLive = viewing ? (products.find((p) => p.id === viewing.id) ?? viewing) : null;


  const categories = useMemo(() => ["All", ...new Set(products.map((p) => p.category))], [products]);
  const filtered = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (query.trim() === "" || p.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart);
  // Waiting on the first answer, not "no products": an empty catalogue must
  // show as empty rather than as skeletons forever.
  const loading = !loaded;

  return (
    <div className="relative min-h-screen pb-28">
      <PageBackground accent="brand" grid={false} />
      <PortalBar>
        <LanguageToggle className="hidden sm:flex" />
        <ThemeToggle className="hidden sm:flex" />
        {profileId && <NotificationBell profileId={profileId} accent="brand" />}
        <Link href="/shop/orders" className={barPill}>
          {t("shop.myOrders")}
        </Link>
        <SignOutButton role="customer" />
      </PortalBar>

      <section className="mx-auto max-w-[1400px] px-2.5 pt-2.5 sm:px-4 sm:pt-4">
        <div className="sheet-wash overflow-hidden px-5 pb-5 pt-8 sm:px-10 sm:pb-8 sm:pt-12">
          <p className="flex items-center gap-2 text-sm text-text-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {t("shop.tagline")}
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <h1 className="font-display text-4xl font-light leading-none tracking-[-0.045em] sm:text-6xl">{t("roles.customer.title")}</h1>
            <label className="relative w-full max-w-md">
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("shop.searchPlaceholder")}
                aria-label={t("shop.searchPlaceholder")}
                className="w-full rounded-full bg-surface py-3.5 pl-11 pr-4 text-sm shadow-[0_10px_30px_-20px_rgba(60,36,160,0.5)] outline-none ring-1 ring-transparent transition-shadow focus:ring-brand/60"
              />
            </label>
          </div>

          <div className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-10 sm:px-10 [&::-webkit-scrollbar]:hidden">
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
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-4 text-sm transition-colors duration-300 ${
                    active ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-surface/80 text-text hover:bg-surface"
                  }`}
                >
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                    {img ? (
                      <Image src={img} alt="" fill sizes="36px" className="object-cover" />
                    ) : (
                      /* "All" has no photograph of its own, so it shows four of
                         the others as a mosaic, which reads as "everything". */
                      <span className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                        {Object.values(CATEGORY_IMAGE)
                          .slice(0, 4)
                          .map((src) => (
                            <span key={src} className="relative">
                              <Image src={src} alt="" fill sizes="18px" className="object-cover" />
                            </span>
                          ))}
                      </span>
                    )}
                  </span>
                  {c === "All" ? t("shop.all") : c}
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1400px] grid-cols-2 gap-2.5 px-2.5 pt-2.5 sm:grid-cols-3 sm:gap-4 sm:px-4 sm:pt-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl card-soft border border-transparent bg-surface p-3.5">
                <div className="mb-2.5 h-20 w-full rounded-xl bg-surface-raised" />
                <div className="mb-2 h-3.5 w-3/4 rounded bg-surface-raised" />
                <div className="h-3 w-1/2 rounded bg-surface-raised" />
              </div>
            ))
          : filtered.map((p, i) => {
              const inCart = cart.find((c) => c.productId === p.id);
              const atLimit = (inCart?.qty ?? 0) >= p.stock_qty;
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
                  className={`group relative overflow-hidden rounded-[1.8rem] bg-surface text-left shadow-[0_22px_50px_-34px_rgba(60,36,160,0.45)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_30px_60px_-30px_rgba(60,36,160,0.55)] ${!p.in_stock ? "opacity-55" : ""}`}
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
                      className="absolute right-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 font-display text-xs font-bold text-bg shadow-lg"
                    >
                      {inCart.qty}
                    </motion.span>
                  )}

                  <div className="p-3.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-text-dim">
                      {p.category} · {p.unit}
                    </p>
                    <p className={`mb-2 h-4 text-[11px] font-semibold ${p.in_stock && p.stock_qty <= LOW_STOCK ? "text-danger" : "invisible"}`}>
                      {t("shop.onlyLeft", { count: p.stock_qty })}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-bold">₹{p.price}</span>
                      {p.in_stock ? (
                        <motion.span
                          role="button"
                          tabIndex={0}
                          whileTap={{ scale: 0.88 }}
                          aria-disabled={atLimit}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({ productId: p.id, name: p.name, price: p.price, unit: p.unit }, p.stock_qty);
                          }}
                          className={`rounded-full bg-brand/15 px-3 py-1.5 text-xs font-bold text-brand transition-colors ${
                            atLimit ? "cursor-not-allowed opacity-40" : "hover:bg-brand hover:text-bg"
                          }`}
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
            className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 pb-[calc(var(--safe-bottom)+1rem)] backdrop-blur"
          >
            <Link
              href="/shop/cart"
              className="mx-auto flex max-w-lg items-center justify-between rounded-xl bg-brand px-5 py-3.5 font-semibold text-bg"
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
        {viewingLive && (
          <motion.div
            key="product-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewing(null)}
            className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/60 pb-[var(--safe-bottom)] backdrop-blur-sm sm:items-center"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="w-full max-w-sm overflow-hidden rounded-t-3xl card-soft border border-transparent bg-surface sm:rounded-3xl"
            >
              <div className="relative aspect-[4/3] w-full">
                <ProductImage
                  src={viewingLive.image_url}
                  gradient={viewingLive.image_gradient}
                  alt={viewingLive.name}
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
                {!viewingLive.in_stock && (
                  <span className="absolute left-3 top-3 rounded-full bg-danger px-2.5 py-1 text-[10px] font-bold uppercase text-white">
                    {t("shop.outOfStock")}
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-wide text-text-dim">
                  {viewingLive.category} · {viewingLive.unit}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">{viewingLive.name}</h2>
                <p className="mt-1 font-display text-lg font-bold text-brand">₹{viewingLive.price}</p>
                {viewingLive.in_stock && viewingLive.stock_qty <= LOW_STOCK && (
                  <p className="mt-1 text-xs font-semibold text-danger">{t("shop.onlyLeft", { count: viewingLive.stock_qty })}</p>
                )}

                <div className="mt-4 rounded-xl border border-border/50 bg-surface-raised p-3.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{t("shop.productDetails")}</p>
                  <p className="text-sm text-text-dim">{t("shop.noInfo")}</p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={(cart.find((c) => c.productId === viewingLive.id)?.qty ?? 0) >= viewingLive.stock_qty}
                  onClick={() => {
                    addToCart(
                      { productId: viewingLive.id, name: viewingLive.name, price: viewingLive.price, unit: viewingLive.unit },
                      viewingLive.stock_qty,
                    );
                    setViewing(null);
                  }}
                  className="mt-5 w-full rounded-full bg-brand py-3 text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
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
