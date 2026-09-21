"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { ProductImage } from "@/components/shop/ProductImage";
import type { Tables } from "@/lib/supabase/types";
import { BoxIcon, ImageIcon, SearchIcon, TrashIcon } from "./icons";

type Product = Tables<"products">;
type StockFilter = "all" | "in" | "out";

const panel = "surface-raised-soft rounded-2xl ring-1 ring-border/70";
const field =
  "w-full rounded-xl bg-bg/60 px-3.5 py-2.5 text-sm outline-none ring-1 ring-border/80 transition-shadow placeholder:text-text-dim/70 focus:ring-amber/70";

export function ProductsTab() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", unit: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  async function load() {
    setProducts(await fetchProducts());
    setLoaded(true);
  }

  useEffect(() => {
    let live = true;
    fetchProducts().then((list) => {
      if (!live) return;
      setProducts(list);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // A confirm that is never taken quietly stands down.
  useEffect(() => {
    if (!confirmId) return;
    const timer = setTimeout(() => setConfirmId(null), 6000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = products.filter(
      (p) =>
        (stock === "all" || (stock === "in" ? p.in_stock : !p.in_stock)) &&
        (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
    );
    const map = new Map<string, Product[]>();
    for (const p of visible) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [products, query, stock]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const category = form.category.trim();
    const unit = form.unit.trim();
    if (!name || !category || !unit || !form.price.trim()) {
      setError(t("admin.products.err.required"));
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      setError(t("admin.products.err.price"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, unit, price }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("admin.products.err.add"));
      setForm({ name: "", category: "", unit: "", price: "" });
      setJustAdded(json.product?.id ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.products.err.add"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStock(p: Product) {
    setError(null);
    // Flip locally first; the switch should move when it is pressed.
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, in_stock: !p.in_stock } : x)));
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_stock: !p.in_stock }),
    });
    if (!res.ok) setError(t("admin.products.err.stock"));
    load();
  }

  async function remove(p: Product) {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      return;
    }
    setBusyId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError(t("admin.products.err.delete"));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* Add */}
      <section className={`${panel} h-fit p-5 lg:sticky lg:top-6`}>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber/15 text-amber">
            <BoxIcon className="h-4 w-4" />
          </span>
          {t("admin.products.addTitle")}
        </h2>
        <p className="mt-2 text-xs text-text-dim">{t("admin.products.formHint")}</p>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
          >
            {error}
          </motion.p>
        )}

        <form onSubmit={handleAdd} className="mt-4 space-y-3" noValidate>
          <Field label={t("admin.products.ph.name")}>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={field}
            />
          </Field>
          <Field label={t("admin.products.ph.category")}>
            <input
              list="product-categories"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={field}
            />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("admin.products.ph.unit")}>
              <input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className={field}
              />
            </Field>
            <Field label={t("admin.products.ph.price")}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-dim">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className={`${field} pl-7 tabular-nums`}
                />
              </div>
            </Field>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving}
            className="mt-1 w-full rounded-xl bg-amber py-2.5 text-sm font-bold text-bg shadow-[0_8px_24px_-10px] shadow-amber transition-opacity disabled:opacity-50"
          >
            {saving ? t("admin.products.adding") : t("admin.products.addBtn")}
          </motion.button>
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
            <ImageIcon className="mt-px h-3.5 w-3.5 shrink-0" />
            {t("admin.products.noPhoto")}
          </p>
        </form>
      </section>

      {/* Catalogue */}
      <section className={`${panel} min-w-0 overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center">
          <h2 className="font-display text-sm font-semibold">
            {t("admin.products.catalog", { count: products.length })}
          </h2>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
            <div className="flex rounded-full bg-surface-raised p-0.5 ring-1 ring-border/70">
              {(
                [
                  ["all", t("admin.filter.all")],
                  ["in", t("admin.products.inStock")],
                  ["out", t("shop.outOfStock")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStock(key)}
                  className={`relative rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    stock === key ? "text-bg" : "text-text-dim hover:text-text"
                  }`}
                >
                  {stock === key && (
                    <motion.span
                      layoutId="stock-filter"
                      className="absolute inset-0 rounded-full bg-amber"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>
            <label className="flex w-full items-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-text-dim ring-1 ring-border/70 focus-within:ring-amber/60 sm:w-56">
              <SearchIcon className="h-3.5 w-3.5 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin.products.search")}
                className="w-full bg-transparent text-xs text-text outline-none placeholder:text-text-dim"
              />
            </label>
          </div>
        </div>

        <div className="space-y-7 p-5">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">{category}</h3>
                <span className="rule-fade flex-1" />
                <span className="text-[11px] tabular-nums text-text-dim">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((p, i) => {
                  const confirming = confirmId === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.03 }}
                      className={`group flex items-center gap-3 rounded-xl bg-surface-raised/60 p-2.5 ring-1 transition-colors ${
                        justAdded === p.id ? "ring-amber/60" : "ring-border/60 hover:ring-border"
                      }`}
                    >
                      <ProductImage
                        src={p.image_url}
                        gradient={p.image_gradient}
                        alt={p.name}
                        sizes="64px"
                        zoomOnHover={false}
                        className={`h-16 w-16 shrink-0 rounded-lg transition-[filter] ${p.in_stock ? "" : "grayscale"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${p.in_stock ? "" : "text-text-dim"}`}>{p.name}</p>
                        <p className="mt-0.5 text-[11px] text-text-dim">{p.unit}</p>
                        <p className="mt-1 font-display text-sm font-semibold tabular-nums">₹{Number(p.price).toFixed(0)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          role="switch"
                          aria-checked={p.in_stock}
                          aria-label={t("admin.products.toggleStock")}
                          title={p.in_stock ? t("admin.products.inStock") : t("shop.outOfStock")}
                          onClick={() => toggleStock(p)}
                          className={`relative h-5 w-9 rounded-full transition-colors ${p.in_stock ? "bg-success" : "bg-border"}`}
                        >
                          <motion.span
                            layout
                            transition={{ type: "spring", stiffness: 600, damping: 32 }}
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${p.in_stock ? "right-0.5" : "left-0.5"}`}
                          />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          onBlur={() => setConfirmId((id) => (id === p.id ? null : id))}
                          disabled={busyId === p.id}
                          aria-label={confirming ? t("admin.tip.confirmDelete") : t("common.delete")}
                          title={confirming ? t("admin.tip.confirmDelete") : t("common.delete")}
                          className={`flex h-7 items-center justify-center rounded-lg text-[11px] font-semibold transition-all ${
                            confirming
                              ? "bg-danger px-2 text-white"
                              : "w-7 text-text-dim opacity-70 hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
                          }`}
                        >
                          {busyId === p.id ? "…" : confirming ? t("admin.confirmQ") : <TrashIcon className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {loaded && grouped.length === 0 && (
            <p className="py-12 text-center text-xs text-text-dim">
              {products.length === 0 ? t("admin.products.empty") : t("admin.products.noMatch")}
            </p>
          )}
          {!loaded && <p className="py-12 text-center text-xs text-text-dim">{t("common.loading")}</p>}
        </div>
      </section>
    </div>
  );
}

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/admin/products");
  const json = await res.json();
  return json.products ?? [];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-text-dim">{label}</span>
      {children}
    </label>
  );
}
