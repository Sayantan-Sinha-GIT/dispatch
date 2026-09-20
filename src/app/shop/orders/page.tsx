"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { formatDateTime } from "@/lib/datetime";
import { isActiveOrder } from "@/lib/orderStatus";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;



export default function ShopOrdersPage() {
  const { t, lang } = useLanguage();
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
        {orders && (
          <span className="ml-auto rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-text-dim">
            {t("orders.activeCount", {
              count: orders.filter((o) => isActiveOrder(o.status)).length,
            })}
          </span>
        )}
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
                  ₹{o.total_amount} · {formatDateTime(o.created_at, lang)}
                </p>
              </div>
              <span className="rounded-full bg-amber/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-amber">
                {t(`status.${o.status}`)}
              </span>
            </Link>
          </motion.div>
        ))}

        {orders?.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-3 text-4xl">🛍️</span>
            <Image src="/images/empty/orders.webp" alt="" width={150} height={150} className="mx-auto mb-4 opacity-70" />
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
