"use client";

import { useEffect, useState } from "react";
import { PageBackground } from "@/components/PageBackground";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { PortalBar } from "@/components/PortalBar";
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
      <PortalBar back="/shop">
        {orders && (
          <span className="rounded-full bg-surface px-3 py-2 text-xs text-text-dim ring-1 ring-border">
            {t("orders.activeCount", {
              count: orders.filter((o) => isActiveOrder(o.status)).length,
            })}
          </span>
        )}
      </PortalBar>

      <main className="mx-auto max-w-xl space-y-2.5 px-4 pb-5 pt-8 sm:pt-12">
        <h1 className="font-display text-4xl font-light tracking-[-0.045em] sm:text-5xl mb-6">{t("orders.myOrders")}</h1>
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
              className="group flex items-center justify-between gap-3 rounded-[1.6rem] card-soft bg-surface p-4 pl-5 transition-transform hover:-translate-y-0.5"
            >
              <div>
                <p className="text-sm font-medium">{o.address}</p>
                <p className="text-xs text-text-dim">
                  ₹{o.total_amount} · {formatDateTime(o.created_at, lang)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-medium text-brand">
                {t(`status.${o.status}`)}
              </span>
            </Link>
          </motion.div>
        ))}

        {orders?.length === 0 && !loadError && (
          <div className="flex flex-col items-center py-16 text-center">
            <Image src="/images/empty/orders.webp" alt="" width={150} height={150} className="mx-auto mb-4 opacity-70" />
            <p className="mb-4 text-sm text-text-dim">{t("orders.empty")}</p>
            <Link href="/shop" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white">
              {t("hero.orderNow").replace(" →", "")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
