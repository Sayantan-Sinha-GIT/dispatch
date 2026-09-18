"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { addToCart, cartCount, cartSubtotal, getCart, type CartItem } from "@/lib/cart";
import type { Tables } from "@/lib/supabase/types";

type Product = Tables<"products">;

export default function ShopCatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>("All");

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
  const filtered = category === "All" ? products : products.filter((p) => p.category === category);
  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart);

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="border-b border-border bg-gradient-to-r from-surface via-surface to-amber/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-amber/60 font-display font-bold text-bg">
              D
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">Shop</h1>
              <p className="text-xs text-text-dim">Fresh groceries, delivered fast</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/shop/orders"
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-dim transition-colors hover:border-amber/50 hover:text-text"
            >
              My orders
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-dim transition-colors hover:border-amber/50 hover:text-text"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                category === c ? "bg-amber text-bg" : "border border-border bg-surface-raised text-text-dim hover:text-text"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <main className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => {
          const inCart = cart.find((c) => c.productId === p.id);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border border-border bg-surface p-3.5 ${!p.in_stock ? "opacity-50" : ""}`}
            >
              <div className={`mb-2.5 h-20 w-full rounded-xl bg-gradient-to-br ${p.image_gradient}`} />
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mb-2 text-xs text-text-dim">
                {p.category} · {p.unit}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold">₹{p.price}</span>
                {p.in_stock ? (
                  <button
                    onClick={() => addToCart({ productId: p.id, name: p.name, price: p.price, unit: p.unit })}
                    className="rounded-lg bg-amber/15 px-2.5 py-1 text-xs font-bold text-amber transition-colors hover:bg-amber/25"
                  >
                    {inCart ? `+ (${inCart.qty})` : "Add"}
                  </button>
                ) : (
                  <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">
                    Out of stock
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
        {products.length === 0 && <p className="col-span-full py-16 text-center text-sm text-text-dim">Loading catalog…</p>}
      </main>

      {count > 0 && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur"
        >
          <Link
            href="/shop/cart"
            className="mx-auto flex max-w-lg items-center justify-between rounded-xl bg-amber px-5 py-3.5 font-semibold text-bg"
          >
            <span>
              {count} item{count > 1 ? "s" : ""} in cart
            </span>
            <span>View cart · ₹{subtotal.toFixed(0)} →</span>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
