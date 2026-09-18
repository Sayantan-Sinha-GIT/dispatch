"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;

const STATUS_LABEL: Record<string, string> = {
  pending: "Finding a rider…",
  offered: "Rider notified",
  assigned: "On the way",
  delivered: "Delivered",
  expired: "Reassigning…",
  failed: "Failed",
};

export default function ShopOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const load = () =>
        supabase
          .from("orders")
          .select("*")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => setOrders(data ?? []));

      load();
      channel = supabase
        .channel(`shop-orders-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` }, load)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-10">
      <header className="flex items-center gap-3.5 border-b border-border px-5 py-5">
        <Link href="/shop" className="text-text">
          ←
        </Link>
        <h1 className="font-display text-lg font-semibold">{t("orders.myOrders")}</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-2.5 p-5">
        {orders === null &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface" />
          ))}

        {orders?.map((o, i) => (
          <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link
              href={`/shop/orders/${o.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:border-amber/40"
            >
              <div>
                <p className="text-sm font-medium">{o.address}</p>
                <p className="text-xs text-text-dim">
                  ₹{o.total_amount} · {new Date(o.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full bg-amber/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-amber">
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </Link>
          </motion.div>
        ))}

        {orders?.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-3 text-4xl">🛍️</span>
            <p className="mb-4 text-sm text-text-dim">{t("orders.empty")}</p>
            <Link href="/shop" className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-bg">
              {t("hero.orderNow").replace(" →", "")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
