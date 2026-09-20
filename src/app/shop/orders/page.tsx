"use client";

import { useEffect, useState } from "react";
import { PageBackground } from "@/components/PageBackground";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
          .then(({ data, error }) => {
            if (cancelled) return;
            if (error) {
              // Never silently degrade to the empty state: that is
              // indistinguishable from having no orders, and it hides exactly
              // the failure worth knowing about.
              setLoadError(error.message);
              return;
            }
            setLoadError(null);
            setOrders(data ?? []);
          });

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
  }, [reloadKey]);

  return (
    <div className="relative min-h-screen pb-10">
      <PageBackground accent="both" image="/images/landing/how-it-works.webp" imageOpacity={0.12} />
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
        {loadError && (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-center">
            <p className="text-sm font-semibold text-danger">{t("orders.loadFailed")}</p>
            <p className="mt-1 break-words text-[11px] text-text-dim">{loadError}</p>
            <button
              type="button"
              onClick={() => { setLoadError(null); setOrders(null); setReloadKey((k) => k + 1); }}
              className="mt-3 rounded-lg border border-danger/40 px-4 py-2 text-xs font-semibold text-danger"
            >
              {t("orders.retry")}
            </button>
          </div>
        )}

        {orders === null && !loadError &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface/70 ring-1 ring-border/60" />
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

        {orders?.length === 0 && !loadError && (
          <div className="flex flex-col items-center py-16 text-center">
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
