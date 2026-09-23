"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { ProductImage } from "@/components/shop/ProductImage";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { isStock } from "@/lib/stock";
import { BoxIcon, ImageIcon, SearchIcon, TrashIcon } from "./icons";

type Product = Tables<"products">;
type View = "all" | "listed" | "delisted" | "out";

const panel = "surface-raised-soft rounded-2xl ring-1 ring-border/70";
const field =
  "w-full rounded-xl bg-bg/60 px-3.5 py-2.5 text-sm outline-none ring-1 ring-border/80 transition-shadow placeholder:text-text-dim/70 focus:ring-brand/70";

// Mirrors the server's limits, so a bad file is refused before it uploads.
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/admin/products");
  const json = await res.json();
  return json.products ?? [];
}

async function uploadImage(productId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/admin/products/${productId}/image`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  return json.imageUrl as string;
}

async function patchProduct(id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Update failed");
}

export function ProductsTab() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", unit: "", price: "", stock: "" });
  const [listNow, setListNow] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);
  const [editingStock, setEditingStock] = useState<{ id: string; value: string } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<string | null>(null);

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
    // Orders move stock while the tab is open, so follow the table live.
    const supabase = createClient();
    const channel = supabase
      .channel("admin-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        fetchProducts().then((list) => live && setProducts(list));
      })
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Object URLs hold the whole file in memory until they are revoked, so the
  // current one is tracked and released on replace, clear and unmount.
  const previewUrl = useRef<string | null>(null);
  function setPreviewFor(file: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setPreview(previewUrl.current);
  }
  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  useEffect(() => {
    if (!error && !notice) return;
    const timer = setTimeout(() => {
      setError(null);
      setNotice(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [error, notice]);

  useEffect(() => {
    if (!confirmId) return;
    const timer = setTimeout(() => setConfirmId(null), 6000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const counts = useMemo(
    () => ({
      all: products.length,
      listed: products.filter((p) => p.is_listed).length,
      delisted: products.filter((p) => !p.is_listed).length,
      out: products.filter((p) => p.stock_qty === 0).length,
    }),
    [products],
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = products.filter((p) => {
      const inView =
        view === "all" ||
        (view === "listed" && p.is_listed) ||
        (view === "delisted" && !p.is_listed) ||
        (view === "out" && p.stock_qty === 0);
      return inView && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    });
    const map = new Map<string, Product[]>();
    for (const p of visible) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [products, query, view]);

  function checkFile(file: File) {
    if (!ACCEPT.includes(file.type)) return t("admin.products.err.fileType");
    if (file.size > MAX_BYTES) return t("admin.products.err.fileSize");
    return null;
  }

  function pickPhoto(file: File | undefined | null) {
    if (!file) return;
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPhoto(file);
    setPreviewFor(file);
  }

  function clearPhoto() {
    setPhoto(null);
    setPreviewFor(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const category = form.category.trim();
    const unit = form.unit.trim();
    if (!name || !category || !unit || !form.price.trim() || !form.stock.trim()) {
      setError(t("admin.products.err.required"));
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      setError(t("admin.products.err.price"));
      return;
    }
    const stockQty = Number(form.stock);
    if (!isStock(stockQty)) {
      setError(t("admin.products.err.stockQty"));
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      // With a photo on the way, create the product hidden and list it only
      // once the photo is in, so the shop never shows a half-made listing.
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, unit, price, stock_qty: stockQty, is_listed: listNow && !photo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("admin.products.err.add"));
      const id: string = json.product.id;

      if (photo) {
        try {
          await uploadImage(id, photo);
          if (listNow) await patchProduct(id, { is_listed: true });
        } catch (err) {
          setError(
            t("admin.products.err.photoAfterCreate", {
              reason: err instanceof Error ? err.message : t("common.err.generic"),
            }),
          );
        }
      }

      setForm({ name: "", category: "", unit: "", price: "", stock: "" });
      clearPhoto();
      setJustAdded(id);
      // If the photo failed, the error above explains it and takes precedence.
      setNotice(listNow ? t("admin.products.addedListed") : t("admin.products.addedDraft"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.products.err.add"));
    } finally {
      setSaving(false);
    }
  }

  async function run(id: string, action: () => Promise<void>, failure: string) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : failure);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function setStock(p: Product, qty: number) {
    if (!isStock(qty)) {
      setError(t("admin.products.err.stockQty"));
      return;
    }
    if (qty === p.stock_qty) return;
    // Move the number locally first; the count should change when it is pressed.
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, stock_qty: qty, in_stock: qty > 0 } : x)));
    run(p.id, () => patchProduct(p.id, { stock_qty: qty }), t("admin.products.err.stock"));
  }

  function saveStock(p: Product) {
    if (!editingStock) return;
    const value = editingStock.value.trim();
    setEditingStock(null);
    if (value === "") return;
    setStock(p, Number(value));
  }

  function toggleListing(p: Product) {
    run(p.id, () => patchProduct(p.id, { is_listed: !p.is_listed }), t("admin.products.err.listing"));
  }

  function savePrice(p: Product) {
    if (!editingPrice) return;
    const price = Number(editingPrice.value);
    setEditingPrice(null);
    if (!Number.isFinite(price) || price <= 0) {
      setError(t("admin.products.err.price"));
      return;
    }
    if (price === Number(p.price)) return;
    run(p.id, () => patchProduct(p.id, { price }), t("admin.products.err.priceUpdate"));
  }

  function startReplace(p: Product) {
    replaceFor.current = p.id;
    replaceInput.current?.click();
  }

  function onReplacePicked(file: File | undefined) {
    const id = replaceFor.current;
    if (replaceInput.current) replaceInput.current.value = "";
    if (!file || !id) return;
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    run(id, async () => void (await uploadImage(id, file)), t("admin.products.err.upload"));
  }

  function remove(p: Product) {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      return;
    }
    setConfirmId(null);
    run(
      p.id,
      async () => {
        const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      },
      t("admin.products.err.delete"),
    );
  }

  const views: { key: View; label: string }[] = [
    { key: "all", label: t("admin.filter.all") },
    { key: "listed", label: t("admin.products.view.listed") },
    { key: "delisted", label: t("admin.products.view.delisted") },
    { key: "out", label: t("shop.outOfStock") },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* Hidden picker shared by every card's "change photo". */}
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onReplacePicked(e.target.files?.[0])}
      />

      {/* List a new product */}
      <section className={`${panel} h-fit p-5 lg:sticky lg:top-6`}>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/15 text-brand">
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
        {notice && !error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success"
          >
            {notice}
          </motion.p>
        )}

        <form onSubmit={handleAdd} className="mt-4 space-y-3" noValidate>
          {/* Photo */}
          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-text-dim">{t("admin.products.photo")}</span>
            <input
              ref={fileInput}
              id="new-product-photo"
              type="file"
              accept={ACCEPT.join(",")}
              className="sr-only"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
            {preview ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-border/80">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview; next/image can't optimise it */}
                <img src={preview} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8">
                  <label
                    htmlFor="new-product-photo"
                    className="cursor-pointer rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25"
                  >
                    {t("admin.products.changePhoto")}
                  </label>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25"
                  >
                    {t("admin.products.removePhoto")}
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="new-product-photo"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickPhoto(e.dataTransfer.files?.[0]);
                }}
                className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors ${
                  dragging ? "border-brand bg-brand/10" : "border-border hover:border-brand/60 hover:bg-brand/5"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <ImageIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold">{t("admin.products.dropPhoto")}</span>
                <span className="text-[11px] text-text-dim">{t("admin.products.photoRules")}</span>
              </label>
            )}
          </div>

          <Field label={t("admin.products.ph.name")}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={field} />
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
              <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className={field} />
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
          <Field label={t("admin.products.ph.stock")}>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              className={`${field} tabular-nums`}
            />
            <span className="mt-1 block text-[11px] leading-relaxed text-text-dim">{t("admin.products.stockHint")}</span>
          </Field>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-bg/40 px-3.5 py-2.5 ring-1 ring-border/60">
            <span>
              <span className="block text-xs font-semibold">{t("admin.products.listNow")}</span>
              <span className="block text-[11px] text-text-dim">{t("admin.products.listNowHint")}</span>
            </span>
            <input
              type="checkbox"
              checked={listNow}
              onChange={(e) => setListNow(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
                listNow ? "bg-success" : "bg-border"
              }`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${listNow ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </label>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-brand py-3 text-sm font-bold text-bg shadow-[0_8px_24px_-10px] shadow-brand transition-opacity disabled:opacity-50"
          >
            {saving ? (photo ? t("admin.products.uploading") : t("admin.products.adding")) : t("admin.products.addBtn")}
          </motion.button>
          {!photo && (
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
              <ImageIcon className="mt-px h-3.5 w-3.5 shrink-0" />
              {t("admin.products.noPhoto")}
            </p>
          )}
        </form>
      </section>

      {/* Catalogue */}
      <section className={`${panel} min-w-0 overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-border/60 p-5 xl:flex-row xl:items-center">
          <h2 className="font-display text-sm font-semibold">{t("admin.products.catalog", { count: products.length })}</h2>
          <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
            <div className="flex flex-wrap rounded-full bg-surface-raised p-0.5 ring-1 ring-border/70">
              {views.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`relative flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    view === key ? "text-bg" : "text-text-dim hover:text-text"
                  }`}
                >
                  {view === key && (
                    <motion.span
                      layoutId="product-view"
                      className="absolute inset-0 rounded-full bg-brand"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                  <span className={`relative tabular-nums ${view === key ? "text-bg/70" : "text-text-dim/70"}`}>{counts[key]}</span>
                </button>
              ))}
            </div>
            <label className="flex w-full items-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-text-dim ring-1 ring-border/70 focus-within:ring-brand/60 sm:w-56">
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
                  const busy = busyId === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.03 }}
                      data-product={p.name}
                      className={`group relative rounded-xl p-2.5 ring-1 transition-colors ${
                        p.is_listed ? "bg-surface-raised/60" : "bg-surface-raised/25"
                      } ${justAdded === p.id ? "ring-brand/60" : "ring-border/60 hover:ring-border"}`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startReplace(p)}
                          disabled={busy}
                          aria-label={t("admin.products.changePhotoFor", { name: p.name })}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                        >
                          <ProductImage
                            src={p.image_url}
                            gradient={p.image_gradient}
                            alt=""
                            sizes="64px"
                            zoomOnHover={false}
                            className={`h-full w-full ${p.stock_qty > 0 && p.is_listed ? "" : "grayscale"}`}
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
                            {busy ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <ImageIcon className="h-4 w-4" />
                            )}
                          </span>
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`truncate text-sm font-semibold ${p.is_listed ? "" : "text-text-dim"}`}>{p.name}</p>
                            {!p.is_listed && (
                              <span className="shrink-0 rounded-full bg-text-dim/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-text-dim">
                                {t("admin.products.delistedBadge")}
                              </span>
                            )}
                            {p.stock_qty === 0 && (
                              <span className="shrink-0 rounded-full bg-danger/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-danger">
                                {t("shop.outOfStock")}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-text-dim">{p.unit}</p>
                          {editingPrice?.id === p.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                savePrice(p);
                              }}
                              className="mt-1 flex items-center gap-1"
                            >
                              <span className="text-sm text-text-dim">₹</span>
                              <input
                                autoFocus
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.5"
                                aria-label={t("admin.products.ph.price")}
                                value={editingPrice.value}
                                onChange={(e) => setEditingPrice({ id: p.id, value: e.target.value })}
                                onBlur={() => savePrice(p)}
                                onKeyDown={(e) => e.key === "Escape" && setEditingPrice(null)}
                                className="w-20 rounded-md bg-bg/70 px-1.5 py-0.5 font-display text-sm font-semibold tabular-nums outline-none ring-1 ring-brand/70"
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingPrice({ id: p.id, value: String(Number(p.price)) })}
                              title={t("admin.products.editPrice")}
                              className="mt-1 rounded-md font-display text-sm font-semibold tabular-nums decoration-brand/60 decoration-dashed underline-offset-4 hover:underline"
                            >
                              ₹{Number(p.price).toFixed(0)}
                            </button>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-center gap-1 self-start">
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-text-dim">{t("admin.products.ph.stock")}</span>
                          <div
                            className={`flex items-center rounded-lg ring-1 ${
                              p.stock_qty === 0 ? "bg-danger/10 ring-danger/40" : "bg-bg/50 ring-border/70"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setStock(p, p.stock_qty - 1)}
                              disabled={busy || p.stock_qty === 0}
                              aria-label={t("admin.products.less")}
                              className="h-7 w-6 text-sm text-text-dim hover:text-text disabled:opacity-30"
                            >
                              −
                            </button>
                            {editingStock?.id === p.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  saveStock(p);
                                }}
                              >
                                <input
                                  autoFocus
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  step="1"
                                  aria-label={t("admin.products.ph.stock")}
                                  value={editingStock.value}
                                  onChange={(e) => setEditingStock({ id: p.id, value: e.target.value })}
                                  onBlur={() => saveStock(p)}
                                  onKeyDown={(e) => e.key === "Escape" && setEditingStock(null)}
                                  className="w-12 rounded bg-bg/80 py-0.5 text-center font-display text-sm font-semibold tabular-nums outline-none ring-1 ring-brand/70"
                                />
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingStock({ id: p.id, value: String(p.stock_qty) })}
                                title={t("admin.products.editStock")}
                                aria-label={t("admin.products.stock", { count: p.stock_qty })}
                                data-stock={p.stock_qty}
                                className={`min-w-8 px-1 font-display text-sm font-semibold tabular-nums decoration-dashed underline-offset-4 hover:underline ${
                                  p.stock_qty === 0 ? "text-danger" : ""
                                }`}
                              >
                                {p.stock_qty}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setStock(p, p.stock_qty + 1)}
                              disabled={busy}
                              aria-label={t("admin.products.more")}
                              className="h-7 w-6 text-sm text-text-dim hover:text-text disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/50 pt-2.5">
                        <button
                          type="button"
                          onClick={() => toggleListing(p)}
                          disabled={busy}
                          className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            p.is_listed
                              ? "bg-surface text-text-dim ring-1 ring-border/70 hover:text-text"
                              : "bg-success/15 text-success hover:bg-success/25"
                          }`}
                        >
                          {p.is_listed ? t("admin.products.delist") : t("admin.products.relist")}
                        </button>
                        <button
                          type="button"
                          onClick={() => startReplace(p)}
                          disabled={busy}
                          className="flex-1 rounded-lg bg-surface py-1.5 text-[11px] font-semibold text-text-dim ring-1 ring-border/70 transition-colors hover:text-text disabled:opacity-50"
                        >
                          {p.image_url ? t("admin.products.changePhoto") : t("admin.products.addPhoto")}
                        </button>
                        <button
                          onClick={() => remove(p)}
                          onBlur={() => setConfirmId((id) => (id === p.id ? null : id))}
                          disabled={busy}
                          aria-label={confirming ? t("admin.tip.confirmDelete") : t("common.delete")}
                          title={confirming ? t("admin.tip.confirmDelete") : t("common.delete")}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all disabled:opacity-50 ${
                            confirming ? "bg-danger text-white" : "bg-surface text-danger/85 ring-1 ring-border/70 hover:bg-danger/15 hover:text-danger"
                          }`}
                        >
                          {confirming ? (
                            t("admin.confirmQ")
                          ) : (
                            <>
                              <TrashIcon className="h-3.5 w-3.5" />
                              {t("common.delete")}
                            </>
                          )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-text-dim">{label}</span>
      {children}
    </label>
  );
}
