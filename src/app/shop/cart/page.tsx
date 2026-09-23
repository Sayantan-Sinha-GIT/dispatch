"use client";

import { useEffect, useRef, useState } from "react";
import { PageBackground } from "@/components/PageBackground";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cartSubtotal, clearCart, setQty } from "@/lib/cart";
import { useCart } from "@/lib/browserState";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { useLanguage } from "@/components/LanguageProvider";
import { SignOutButton } from "@/components/SignOutButton";
import { PortalBar } from "@/components/PortalBar";
import { createClient } from "@/lib/supabase/client";

const DELIVERY_FEE = 25;
/**
 * Last-resort map centre, used only when we know nothing about the customer:
 * no previous order and no location permission. It is a placeholder to open a
 * map on, never a place we would deliver to — a hardcoded city here is how a
 * Kolkata customer ended up with a Bengaluru pin.
 */
const FALLBACK_CENTER = { lat: 22.5726, lng: 88.3639 };

export default function ShopCartPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const cart = useCart();
  const [houseNo, setHouseNo] = useState("");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mapSeed, setMapSeed] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [stockVersion, setStockVersion] = useState(0);
  const cartIds = cart.map((c) => c.productId).sort().join(",");

  // What is actually left, so the + button stops at it and a line that asks
  // for more than there is says so before checkout does. Delisted products
  // come back missing and count as none left.
  useEffect(() => {
    if (!cartIds) return;
    let live = true;
    const ids = cartIds.split(",");
    createClient()
      .from("products")
      .select("id, stock_qty")
      .in("id", ids)
      .then(({ data }) => {
        if (!live || !data) return;
        const left: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
        for (const p of data) left[p.id] = p.stock_qty;
        setStock(left);
      });
    return () => {
      live = false;
    };
  }, [cartIds, stockVersion]);

  // Open the map somewhere the customer plausibly is: their last delivery
  // address first (people reorder to the same place), then the device's own
  // position. Neither is treated as a confirmed pin — they only decide where
  // the map opens, and the customer still has to confirm.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: previous } = await supabase
        .from("orders")
        .select("lat, lng")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (previous) {
        setMapSeed({ lat: previous.lat, lng: previous.lng });
        return;
      }
      if (!("geolocation" in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) setMapSeed({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Denied or unavailable: the fallback centre stands.
        },
        { timeout: 8000 },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePlaceOrder() {
    if (submittingRef.current) return;
    if (!houseNo.trim() || !street.trim() || !locality.trim()) {
      setError(t("cart.err.missingAddress"));
      return;
    }
    if (!coords) {
      setError(t("cart.err.noPin"));
      return;
    }
    submittingRef.current = true;
    setError(null);
    setPlacing(true);
    const address = [houseNo, street, locality, landmark && `near ${landmark}`].filter(Boolean).join(", ");
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
          address,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      const json = await res.json();
      if (json.code === "out_of_stock") {
        setStockVersion((v) => v + 1);
        throw new Error(
          json.available > 0
            ? t("cart.err.outOfStock", { name: json.name, count: json.available })
            : t("cart.err.soldOut", { name: json.name }),
        );
      }
      if (!res.ok) throw new Error(json.error ?? t("cart.err.placeFailed"));
      clearCart();
      router.push(`/shop/orders/${json.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cart.err.placeFailed"));
    } finally {
      setPlacing(false);
      submittingRef.current = false;
    }
  }

  const subtotal = cartSubtotal(cart);
  const total = cart.length > 0 ? subtotal + DELIVERY_FEE : 0;

  return (
    <div className="relative min-h-screen pb-32">
      <PageBackground accent="brand" />
      <PortalBar back="/shop">
        <SignOutButton role="customer" />
      </PortalBar>

      <main className="mx-auto max-w-xl space-y-5 px-4 pb-5 pt-8 sm:pt-12">
        <h1 className="font-display text-4xl font-light tracking-[-0.045em] sm:text-5xl">{t("cart.title")}</h1>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Image src="/images/empty/cart.webp" alt="" width={150} height={150} className="mb-4 opacity-70" />
            <p className="text-center text-sm text-text-dim">{t("cart.empty")}</p>
            <Link
              href="/shop"
              className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-bg shadow-lg shadow-brand/25 transition-transform hover:scale-[1.04] active:scale-95"
            >
              {t("roles.customer.cta")}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cart.map((item) => (
              <motion.div
                key={item.productId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 rounded-xl card-soft border border-transparent bg-surface p-3"
              >
                <div className="flex-grow">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-text-dim">₹{item.price} {t("cart.each")}</p>
                  {item.productId in stock && item.qty > stock[item.productId] && (
                    <p className="mt-0.5 text-xs font-semibold text-danger">
                      {stock[item.productId] > 0 ? t("cart.onlyLeft", { count: stock[item.productId] }) : t("cart.soldOut")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-surface-raised px-2 py-1">
                  <button onClick={() => setQty(item.productId, item.qty - 1)} className="px-1.5 text-sm transition-transform active:scale-90">
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-semibold">{item.qty}</span>
                  <button
                    onClick={() => setQty(item.productId, item.qty + 1)}
                    disabled={item.productId in stock && item.qty >= stock[item.productId]}
                    className="px-1.5 text-sm transition-transform active:scale-90 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <section>
            <h2 className="mb-2.5 font-display text-sm font-semibold">{t("cart.deliveryAddress")}</h2>
            <div className="space-y-2.5">
              <input
                value={houseNo}
                onChange={(e) => setHouseNo(e.target.value)}
                placeholder={t("cart.houseNo")}
                className="w-full rounded-2xl border border-transparent bg-surface-raised px-4 py-3 text-sm outline-none focus:border-brand"
              />
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder={t("cart.street")}
                className="w-full rounded-2xl border border-transparent bg-surface-raised px-4 py-3 text-sm outline-none focus:border-brand"
              />
              <input
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder={t("cart.locality")}
                className="w-full rounded-2xl border border-transparent bg-surface-raised px-4 py-3 text-sm outline-none focus:border-brand"
              />
              <input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder={t("cart.landmark")}
                className="w-full rounded-2xl border border-transparent bg-surface-raised px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setPickerOpen(true)}
              className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                coords ? "border border-success/40 bg-success/10 text-success" : "border border-brand/40 bg-brand/10 text-brand hover:bg-brand/20"
              }`}
            >
              {coords ? (
                <>
                  📍 {t("cart.locationPinned")}{" "}
                  <span className="font-mono text-[11px] opacity-70">
                    ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                  </span>
                </>
              ) : (
                `🗺️ ${t("cart.pinOnMap")}`
              )}
            </motion.button>
          </section>
        )}

        {cart.length > 0 && (
          <section className="rounded-xl card-soft border border-transparent bg-surface p-4">
            <h2 className="mb-3 font-display text-sm font-semibold">{t("cart.orderSummary")}</h2>
            <div className="mb-2 flex justify-between text-sm text-text-dim">
              <span>{t("cart.subtotal")}</span>
              <span className="text-text">₹{subtotal.toFixed(0)}</span>
            </div>
            <div className="mb-2 flex justify-between border-b border-dashed border-border pb-3 text-sm text-text-dim">
              <span>{t("cart.deliveryFee")}</span>
              <span className="text-text">₹{DELIVERY_FEE}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>{t("cart.total")}</span>
              <span>₹{total.toFixed(0)}</span>
            </div>
          </section>
        )}

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 px-2.5 pb-2.5 sm:px-4 sm:pb-4">
          <div className="glass mx-auto max-w-xl rounded-[1.8rem] p-2.5 shadow-[0_18px_40px_-20px_rgba(40,24,110,0.45)] ring-1 ring-border/70">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handlePlaceOrder}
            disabled={placing}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {placing ? t("cart.placing") : `${t("cart.placeOrder")} · ₹${total.toFixed(0)}`}
          </motion.button>
          <p className="mt-1.5 pb-0.5 text-center text-[11px] text-text-dim">{t("cart.autoAssignNote")}</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <LocationPickerModal
            key="location-picker"
            initialLat={coords?.lat ?? mapSeed?.lat ?? FALLBACK_CENTER.lat}
            initialLng={coords?.lng ?? mapSeed?.lng ?? FALLBACK_CENTER.lng}
            onClose={() => setPickerOpen(false)}
            onConfirm={(lat, lng, guess) => {
              setCoords({ lat, lng });
              if (guess) {
                if (!houseNo && guess.houseNo) setHouseNo(guess.houseNo);
                if (!street && guess.street) setStreet(guess.street);
                if (!locality && guess.locality) setLocality(guess.locality);
              }
              setPickerOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
