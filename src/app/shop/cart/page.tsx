"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cartSubtotal, clearCart, getCart, setQty, type CartItem } from "@/lib/cart";

const DELIVERY_FEE = 25;

export default function ShopCartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCart(getCart());
    const onUpdate = () => setCart(getCart());
    window.addEventListener("cart-updated", onUpdate);
    return () => window.removeEventListener("cart-updated", onUpdate);
  }, []);

  function useMyLocation() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setError(`Couldn't get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handlePlaceOrder() {
    if (!address.trim() || !lat || !lng) {
      setError("Add your delivery address and location.");
      return;
    }
    setError(null);
    setPlacing(true);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
          address,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
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
        <h1 className="font-display text-lg font-semibold">Your cart</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-5">
        {cart.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-dim">Your cart is empty.</p>
        ) : (
          <div className="space-y-2.5">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex-grow">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-text-dim">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-surface-raised px-2 py-1">
                  <button onClick={() => setQty(item.productId, item.qty - 1)} className="px-1 text-sm">
                    −
                  </button>
                  <span className="text-sm font-semibold">{item.qty}</span>
                  <button onClick={() => setQty(item.productId, item.qty + 1)} className="px-1 text-sm">
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold">Delivery address</h2>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            placeholder="Flat / house no., street, landmark, area"
            className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-amber"
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="mt-2 w-full rounded-lg border border-amber/40 bg-amber/10 py-2 text-sm font-medium text-amber transition-colors hover:bg-amber/20 disabled:opacity-50"
          >
            {locating ? "Locating…" : lat ? "📍 Location captured" : "Use my current location"}
          </button>
        </section>

        {cart.length > 0 && (
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-sm font-semibold">Order summary</h2>
            <div className="mb-2 flex justify-between text-sm text-text-dim">
              <span>Subtotal</span>
              <span className="text-text">₹{subtotal.toFixed(0)}</span>
            </div>
            <div className="mb-2 flex justify-between border-b border-dashed border-border pb-3 text-sm text-text-dim">
              <span>Delivery fee</span>
              <span className="text-text">₹{DELIVERY_FEE}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
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
            {placing ? "Placing order…" : `Place order · ₹${total.toFixed(0)}`}
          </motion.button>
          <p className="mt-2 text-center text-[11px] text-text-dim">Auto-assigned to the nearest available rider instantly</p>
        </div>
      )}
    </div>
  );
}
