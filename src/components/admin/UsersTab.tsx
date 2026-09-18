"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

interface CustomerRow {
  id: string;
  name: string;
  created_at: string;
  order_count: number;
  total_spent: number;
  cancelled_count: number;
}

interface RiderRow {
  id: string;
  name: string;
  created_at: string;
  rider_status: string | null;
  capacity: number | null;
  total_deliveries: number;
  total_earnings: number;
  total_penalties: number;
  total_declines: number;
  suspended_until: string | null;
  open_orders: number;
}

export function UsersTab() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/customers");
    const json = await res.json();
    setCustomers(json.customers ?? []);
    setRiders(json.riders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!confirmId) return;
    const id = setTimeout(() => setConfirmId(null), 12000);
    return () => clearTimeout(id);
  }, [confirmId]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error]);

  async function remove(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.users.deleteFailed"));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  function DeleteButton({ id }: { id: string }) {
    const isConfirming = confirmId === id;
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => remove(id)}
        disabled={deletingId === id}
        title={isConfirming ? t("admin.users.deleteConfirm") : t("admin.users.delete")}
        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
          isConfirming
            ? "bg-danger text-white"
            : "text-text-dim hover:bg-danger/15 hover:text-danger"
        }`}
      >
        {deletingId === id
          ? t("admin.users.deleting")
          : isConfirming
            ? t("admin.confirmQ")
            : "🗑"}
      </motion.button>
    );
  }

  if (loading) {
    return <p className="p-6 text-xs text-text-dim">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-5 p-6">
      <AnimatePresence>
        {error && (
          <motion.p
            key="users-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="text-[11px] text-text-dim">{t("admin.users.deleteNote")}</p>

      {/* Riders */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">
          {t("admin.users.riders", { count: riders.length })}
        </h2>
        {riders.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-dim">{t("admin.users.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-dim">
                <tr>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.name")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.status")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.deliveries")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.earnings")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => {
                  const suspended =
                    !!r.suspended_until && new Date(r.suspended_until).getTime() > Date.now();
                  return (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            suspended
                              ? "text-danger"
                              : r.rider_status === "active"
                                ? "text-success"
                                : "text-text-dim"
                          }
                        >
                          {suspended
                            ? t("admin.suspended")
                            : r.rider_status === "active"
                              ? t("admin.users.online")
                              : t("admin.users.offline")}
                        </span>
                        {r.open_orders > 0 && (
                          <span className="ml-1 text-text-dim">· {r.open_orders}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{r.total_deliveries}</td>
                      <td className="py-2 pr-3">₹{Math.round(r.total_earnings)}</td>
                      <td className="py-2 pr-3">
                        <DeleteButton id={r.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Customers */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">
          {t("admin.users.customers", { count: customers.length })}
        </h2>
        {customers.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-dim">{t("admin.users.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-dim">
                <tr>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.name")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.joined")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.orders")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.value")}</th>
                  <th className="pb-2 pr-3 font-medium">{t("admin.users.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 text-text-dim">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3">{c.order_count}</td>
                    <td className="py-2 pr-3">₹{Math.round(c.total_spent)}</td>
                    <td className="py-2 pr-3">
                      <DeleteButton id={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
