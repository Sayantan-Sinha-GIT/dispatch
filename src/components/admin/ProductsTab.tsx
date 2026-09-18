"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Tables } from "@/lib/supabase/types";

type Product = Tables<"products">;

export function ProductsTab() {
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
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.category || !form.unit || !form.price) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add product");
      setForm({ name: "", category: "", unit: "", price: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
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
      setError("Couldn't update stock status");
      return;
    }
    load();
  }

  async function remove(p: Product) {
    setError(null);
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete that product");
      return;
    }
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[320px_1fr]">
      <section className="h-fit rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">Add product</h2>
        {error && (
          <p className="mb-2.5 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>
        )}
        <form onSubmit={handleAdd} className="space-y-2.5">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <input
            placeholder="Category (e.g. Dairy)"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <input
            placeholder="Unit (e.g. 500ml)"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
          />
          <input
            type="number"
            placeholder="Price (₹)"
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
            {saving ? "Adding…" : "Add product"}
          </motion.button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">Catalog ({products.length})</h2>
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
                  {p.in_stock ? "In stock" : "Out of stock"}
                </button>
                <button onClick={() => remove(p)} className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="col-span-full py-8 text-center text-xs text-text-dim">No products yet.</p>}
        </div>
      </section>
    </div>
  );
}
