"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders"> & { riders?: { profiles?: { name: string } | null } | null };

const STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "offered", label: "Rider notified" },
  { key: "assigned", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

function stepIndex(status: string) {
  if (status === "delivered") return 3;
  if (status === "assigned") return 2;
  if (status === "offered" || status === "expired") return 1;
  return 0;
}

export default function ShopOrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const load = () =>
      supabase
        .from("orders")
        .select("*, riders(profiles(name))")
        .eq("id", id)
        .single()
        .then(({ data }) => setOrder(data as unknown as Order));

    load();
    const channel = supabase
      .channel(`shop-order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (!order) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-dim">Loading…</div>;
  }

  const active = stepIndex(order.status);
  const items = Array.isArray(order.items) ? (order.items as { name: string; qty: number; price: number }[]) : [];

  return (
    <div className="min-h-screen bg-bg pb-10">
      <header className="flex items-center gap-3.5 border-b border-border px-5 py-5">
        <Link href="/shop/orders" className="text-text">
          ←
        </Link>
        <div>
          <p className="text-[11px] text-text-dim">Order #{order.id.slice(0, 8)}</p>
          <h1 className="font-display text-lg font-semibold">
            {order.status === "delivered" ? "Delivered" : "On the way to you"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-5">
        {order.riders?.profiles?.name && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan font-display font-bold text-bg">
              {order.riders.profiles.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold">{order.riders.profiles.name}</p>
              <p className="text-xs text-text-dim">Your delivery partner</p>
            </div>
          </div>
        )}

        <div className="relative space-y-5 pl-6">
          <div className="absolute bottom-1.5 left-[7px] top-1.5 w-0.5 bg-border" />
          {STEPS.map((step, i) => (
            <div key={step.key} className="relative">
              <span
                className={`absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-bg ${
                  i <= active ? "bg-success" : "bg-border"
                } ${i === active && active < 3 ? "shadow-[0_0_0_5px_rgba(61,220,151,0.2)]" : ""}`}
              />
              <p className={`text-sm font-semibold ${i > active ? "text-text-dim" : ""}`}>{step.label}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 font-display text-sm font-semibold">Order summary</h2>
          {items.map((it, i) => (
            <div key={i} className="mb-1.5 flex justify-between text-sm text-text-dim">
              <span>
                {it.qty}× {it.name}
              </span>
              <span className="text-text">₹{it.price * it.qty}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold">
            <span>Total</span>
            <span>₹{order.total_amount}</span>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 font-display text-sm font-semibold">Delivering to</h2>
          <p className="text-sm text-text-dim">{order.address}</p>
        </section>
      </main>
    </div>
  );
}
