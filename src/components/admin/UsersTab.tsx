"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { ROUTE_COLORS } from "@/lib/routeColors";
import { SearchIcon, TrashIcon } from "./icons";

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

interface Accounts {
  customers: CustomerRow[];
  riders: RiderRow[];
}

async function fetchAccounts(): Promise<Accounts> {
  const res = await fetch("/api/admin/customers");
  const json = await res.json();
  return { customers: json.customers ?? [], riders: json.riders ?? [] };
}

const LOCALES = { en: "en-IN", hi: "hi-IN" } as const;
const panel = "surface-raised-soft rounded-2xl ring-1 ring-border/70";

function Avatar({ name, seed }: { name: string; seed: string }) {
  // Stable colour per account, so a person keeps the same swatch between visits.
  const hash = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const color = ROUTE_COLORS[hash % ROUTE_COLORS.length];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-bg"
      style={{ backgroundColor: color }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function UsersTab() {
  const { t, lang } = useLanguage();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"riders" | "customers">("riders");
  const [query, setQuery] = useState("");
  // Read once per load rather than during render, so rendering stays pure.
  const [now, setNow] = useState(0);

  const apply = useCallback((data: Accounts) => {
    setCustomers(data.customers);
    setRiders(data.riders);
    setNow(Date.now());
    setLoading(false);
  }, []);

  const load = useCallback(async () => apply(await fetchAccounts()), [apply]);

  useEffect(() => {
    let live = true;
    fetchAccounts().then((data) => live && apply(data));
    return () => {
      live = false;
    };
  }, [apply]);

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

  const q = query.trim().toLowerCase();
  const shownRiders = useMemo(() => riders.filter((r) => !q || r.name.toLowerCase().includes(q)), [riders, q]);
  const shownCustomers = useMemo(
    () => customers.filter((c) => !q || c.name.toLowerCase().includes(q)),
    [customers, q],
  );

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
        onBlur={() => setConfirmId((cur) => (cur === id ? null : cur))}
        disabled={deletingId === id}
        aria-label={isConfirming ? t("admin.users.deleteConfirm") : t("admin.users.delete")}
        title={isConfirming ? t("admin.users.deleteConfirm") : t("admin.users.delete")}
        className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold transition-all disabled:opacity-60 ${
          isConfirming ? "bg-danger px-2.5 text-white" : "w-8 text-text-dim hover:bg-danger/15 hover:text-danger"
        }`}
      >
        {deletingId === id ? "…" : isConfirming ? t("admin.confirmQ") : <TrashIcon className="h-4 w-4" />}
      </motion.button>
    );
  }

  const date = (value: string) =>
    new Date(value).toLocaleDateString(LOCALES[lang] ?? "en-IN", { day: "numeric", month: "short", year: "numeric" });
  const money = (n: number) => `₹${Math.round(n).toLocaleString(LOCALES[lang] ?? "en-IN")}`;
  const th = "px-4 pb-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim";

  return (
    <div className="space-y-5">
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-2.5 text-xs text-danger"
        >
          {error}
        </motion.p>
      )}

      <section className={`${panel} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-fit rounded-full bg-surface-raised p-0.5 ring-1 ring-border/70">
            {(
              [
                ["riders", t("admin.users.riders", { count: riders.length })],
                ["customers", t("admin.users.customers", { count: customers.length })],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  view === key ? "text-bg" : "text-text-dim hover:text-text"
                }`}
              >
                {view === key && (
                  <motion.span
                    layoutId="users-view"
                    className="absolute inset-0 rounded-full bg-amber"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-text-dim ring-1 ring-border/70 focus-within:ring-amber/60 sm:w-64">
            <SearchIcon className="h-3.5 w-3.5 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.users.search")}
              className="w-full bg-transparent text-xs text-text outline-none placeholder:text-text-dim"
            />
          </label>
        </div>

        {loading ? (
          <p className="py-14 text-center text-xs text-text-dim">{t("common.loading")}</p>
        ) : (
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="overflow-x-auto pt-4"
          >
            {view === "riders" ? (
              shownRiders.length === 0 ? (
                <Empty text={riders.length === 0 ? t("admin.users.empty") : t("admin.users.noMatch")} />
              ) : (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr>
                      <th className={th}>{t("admin.users.col.name")}</th>
                      <th className={th}>{t("admin.users.col.status")}</th>
                      <th className={`${th} text-right`}>{t("admin.users.col.deliveries")}</th>
                      <th className={`${th} text-right`}>{t("admin.users.col.earnings")}</th>
                      <th className={`${th} w-16`} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {shownRiders.map((r) => {
                      const suspended = !!r.suspended_until && new Date(r.suspended_until).getTime() > now;
                      const online = r.rider_status === "active";
                      const tone = suspended ? "danger" : online ? "success" : "text-dim";
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-surface-raised/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.name} seed={r.id} />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{r.name}</p>
                                <p className="text-[11px] text-text-dim">
                                  {t("admin.users.cap", { n: r.capacity ?? "—" })}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                backgroundColor: `color-mix(in srgb, var(--${tone}) 13%, transparent)`,
                                color: `var(--${tone})`,
                              }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {suspended ? t("admin.suspended") : online ? t("admin.users.online") : t("admin.users.offline")}
                            </span>
                            {r.open_orders > 0 && (
                              <span className="ml-2 text-[11px] tabular-nums text-text-dim">· {r.open_orders}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{r.total_deliveries}</td>
                          <td className="px-4 py-3 text-right font-display font-semibold tabular-nums">{money(r.total_earnings)}</td>
                          <td className="px-4 py-3 text-right">
                            <DeleteButton id={r.id} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : shownCustomers.length === 0 ? (
              <Empty text={customers.length === 0 ? t("admin.users.empty") : t("admin.users.noMatch")} />
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t("admin.users.col.name")}</th>
                    <th className={th}>{t("admin.users.col.joined")}</th>
                    <th className={`${th} text-right`}>{t("admin.users.col.orders")}</th>
                    <th className={`${th} text-right`}>{t("admin.users.col.value")}</th>
                    <th className={`${th} w-16`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {shownCustomers.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-surface-raised/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} seed={c.id} />
                          <p className="truncate font-medium">{c.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-dim">{date(c.created_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.order_count}</td>
                      <td className="px-4 py-3 text-right font-display font-semibold tabular-nums">{money(c.total_spent)}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteButton id={c.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        )}

        <p className="border-t border-border/60 px-5 py-3 text-[11px] text-text-dim">{t("admin.users.deleteNote")}</p>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-14 text-center text-xs text-text-dim">{text}</p>;
}
