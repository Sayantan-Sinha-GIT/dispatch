"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cartSubtotal, clearCart, getCart, setQty, type CartItem } from "@/lib/cart";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { useLanguage } from "@/components/LanguageProvider";

const DELIVERY_FEE = 25;
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

export default function ShopCartPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [houseNo, setHouseNo] = useState("");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    setCart(getCart());
    const onUpdate = () => setCart(getCart());
    window.addEventListener("cart-updated", onUpdate);
    return () => window.removeEventListener("cart-updated", onUpdate);
  }, []);

  async function handlePlaceOrder() {
    if (submittingRef.current) return;
    if (!houseNo.trim() || !street.trim() || !locality.trim()) {
      setError("Fill in house/flat no., street, and locality.");
      return;
    }
    if (!coords) {
      setError("Pin your delivery location on the map.");
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
      if (!res.ok) throw new Error(json.error ?? "Could not place order");
      clearCart();
      router.push(`/shop/orders/${json.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setPlacing(false);
      submittingRef.current = false;
    }
  }

  const subtotal = cartSubtotal(cart);
  const total = cart.length > 0 ? subtotal + DELIVERY_FEE : 0;

  return (
    <div className="min-h-screen bg-bg pb-32">
      <header className="flex items-center gap-3.5 border-b border-border px-5 py-5">
        <Link href="/shop" className="text-text">
          ←
        </Link>
        <h1 className="font-display text-lg font-semibold">{t("cart.title")}</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-5">
        {cart.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-dim">{t("cart.empty")}</p>
        ) : (
          <div className="space-y-2.5">
            {cart.map((item) => (
              <motion.div
                key={item.productId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex-grow">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-text-dim">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-surface-raised px-2 py-1">
                  <button onClick={() => setQty(item.productId, item.qty - 1)} className="px-1.5 text-sm transition-transform active:scale-90">
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-semibold">{item.qty}</span>
                  <button onClick={() => setQty(item.productId, item.qty + 1)} className="px-1.5 text-sm transition-transform active:scale-90">
                    +
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold">{t("cart.deliveryAddress")}</h2>
          <div className="space-y-2.5">
            <input
              value={houseNo}
              onChange={(e) => setHouseNo(e.target.value)}
              placeholder={t("cart.houseNo")}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-amber"
            />
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder={t("cart.street")}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-amber"
            />
            <input
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder={t("cart.locality")}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-amber"
            />
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder={t("cart.landmark")}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-amber"
            />
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setPickerOpen(true)}
            className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              coords ? "border border-success/40 bg-success/10 text-success" : "border border-amber/40 bg-amber/10 text-amber hover:bg-amber/20"
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

        {cart.length > 0 && (
          <section className="rounded-xl border border-border bg-surface p-4">
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
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handlePlaceOrder}
            disabled={placing}
            className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-xl bg-amber py-3.5 text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {placing ? t("cart.placing") : `${t("cart.placeOrder")} · ₹${total.toFixed(0)}`}
          </motion.button>
          <p className="mt-2 text-center text-[11px] text-text-dim">{t("cart.autoAssignNote")}</p>
        </div>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <LocationPickerModal
            initialLat={coords?.lat ?? DEFAULT_CENTER.lat}
            initialLng={coords?.lng ?? DEFAULT_CENTER.lng}
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
