"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Product = Tables<"products">;

export function ProductsTab() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", category: "", unit: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/products");
    const json = await res.json();
    setProducts(json.products ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.products.err.add"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStock(p: Product) {
    setError(null);
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_stock: !p.in_stock }),
    });
    if (!res.ok) {
      setError(t("admin.products.err.stock"));
      return;
    }
    load();
  }

  async function remove(p: Product) {
    setError(null);
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(t("admin.products.err.delete"));
      return;
    }
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[320px_1fr]">
      <section className="h-fit rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">{t("admin.products.addTitle")}</h2>
        {error && (
          <p className="mb-2.5 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>
        )}
        <form onSubmit={handleAdd} className="space-y-2.5">
          <input
            placeholder={t("admin.products.ph.name")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <input
            placeholder={t("admin.products.ph.category")}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <input
            placeholder={t("admin.products.ph.unit")}
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <input
            type="number"
            placeholder={t("admin.products.ph.price")}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-amber py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {saving ? t("admin.products.adding") : t("admin.products.addBtn")}
          </motion.button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">{t("admin.products.catalog", { count: products.length })}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className={`rounded-xl border border-border bg-surface-raised p-3 ${!p.in_stock ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-text-dim">
                    {p.category} · {p.unit}
                  </p>
                </div>
                <span className="font-display text-sm font-bold">₹{p.price}</span>
              </div>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => toggleStock(p)}
                  className={`flex-grow rounded-lg py-1.5 text-xs font-medium ${
                    p.in_stock ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  }`}
                >
                  {p.in_stock ? t("admin.products.inStock") : t("shop.outOfStock")}
                </button>
                <button onClick={() => remove(p)} className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="col-span-full py-8 text-center text-xs text-text-dim">{t("admin.products.empty")}</p>}
        </div>
      </section>
    </div>
  );
}
