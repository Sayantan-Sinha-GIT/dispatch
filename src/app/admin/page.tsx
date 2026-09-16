"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { StatCounter } from "@/components/StatCounter";
import { RouteMapClient } from "@/components/RouteMapClient";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;
type Rider = Tables<"riders"> & { profiles?: { name: string } | null };
type OptimizationRun = Tables<"optimization_runs">;

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [lastRun, setLastRun] = useState<OptimizationRun | null>(null);
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [newRider, setNewRider] = useState({ name: "", capacity: 10, depotLat: "", depotLng: "" });
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [ordersRes, ridersRes, runsRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("riders").select("*, profiles(name)"),
      supabase.from("optimization_runs").select("*").order("run_at", { ascending: false }).limit(1),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (ridersRes.data) setRiders(ridersRes.data as unknown as Rider[]);
    if (runsRes.data && runsRes.data.length > 0) setLastRun(runsRes.data[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    loadData();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleParseOrders(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim()) return;
    setParsing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/orders/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(`Added ${json.orders.length} order(s).`);
      setRawText("");
      loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to parse orders");
    } finally {
      setParsing(false);
    }
  }

  async function handleAddRider(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    // For a real signup flow a rider profile would be created via auth; for this
    // demo the admin links a rider row to a pre-seeded profile id by name lookup.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("name", newRider.name)
      .eq("role", "rider")
      .single();

    if (!profile) {
      setMessage(`No rider profile named "${newRider.name}" found. Seed the account first.`);
      return;
    }

    const { error } = await supabase.from("riders").insert({
      profile_id: profile.id,
      capacity: newRider.capacity,
      depot_lat: parseFloat(newRider.depotLat),
      depot_lng: parseFloat(newRider.depotLng),
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`Rider ${newRider.name} added.`);
      setNewRider({ name: "", capacity: 10, depotLat: "", depotLng: "" });
      loadData();
    }
  }

  async function handleOptimize() {
    setOptimizing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/optimize", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Routes optimized.");
      loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  }

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const distanceSaved =
    lastRun && lastRun.total_distance_before > 0
      ? ((lastRun.total_distance_before - lastRun.total_distance_after) /
          lastRun.total_distance_before) *
        100
      : 0;

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber text-bg font-display font-bold text-sm">
            D
          </span>
          <h1 className="font-display text-lg font-semibold">Dispatch Console</h1>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-dim transition-colors hover:border-amber/50 hover:text-text"
        >
          Sign out
        </button>
      </header>

      <main className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <section className="grid grid-cols-3 gap-3">
            <StatCard label="Pending" value={pendingCount} />
            <StatCard label="Delivered" value={deliveredCount} />
            <StatCard label="Riders" value={riders.length} />
          </section>

          {lastRun && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-dim">
                Last optimization
              </p>
              <div className="flex items-baseline gap-2">
                <StatCounter
                  value={lastRun.total_distance_after}
                  suffix=" km"
                  className="font-display text-2xl font-semibold text-cyan"
                />
                <span className="text-xs text-text-dim line-through">
                  {lastRun.total_distance_before.toFixed(1)} km
                </span>
              </div>
              <p className="mt-1 text-xs text-success">
                {distanceSaved > 0 ? `${distanceSaved.toFixed(0)}% shorter than naive baseline` : ""}
              </p>
            </motion.section>
          )}

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-sm font-semibold">Add orders</h2>
            <form onSubmit={handleParseOrders} className="space-y-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste messy order text, e.g. '2kg parcel to 12 MG Road, Bangalore, deliver between 2-4pm; also one to Koramangala 5th block...'"
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-amber"
              />
              <button
                type="submit"
                disabled={parsing}
                className="w-full rounded-lg bg-amber py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {parsing ? "Parsing…" : "Parse with Gemini"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-sm font-semibold">Add rider</h2>
            <form onSubmit={handleAddRider} className="space-y-2.5">
              <input
                placeholder="Rider name (must match a seeded profile)"
                value={newRider.name}
                onChange={(e) => setNewRider((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Capacity"
                  value={newRider.capacity}
                  onChange={(e) => setNewRider((s) => ({ ...s, capacity: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
                />
                <input
                  placeholder="Depot lat"
                  value={newRider.depotLat}
                  onChange={(e) => setNewRider((s) => ({ ...s, depotLat: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
                />
                <input
                  placeholder="Depot lng"
                  value={newRider.depotLng}
                  onChange={(e) => setNewRider((s) => ({ ...s, depotLng: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-amber"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg border border-border py-2 text-sm font-semibold transition-colors hover:border-amber/50"
              >
                Add rider
              </button>
            </form>
          </section>

          <button
            onClick={handleOptimize}
            disabled={optimizing || riders.length === 0}
            className="w-full rounded-lg bg-cyan py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {optimizing ? "Optimizing…" : "Optimize routes"}
          </button>

          <AnimatePresence>
            {message && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-dim"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-sm font-semibold">Orders ({orders.length})</h2>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs"
                >
                  <span className="truncate pr-2">{order.address}</span>
                  <StatusPill status={order.status} />
                </div>
              ))}
              {orders.length === 0 && (
                <p className="py-4 text-center text-xs text-text-dim">No orders yet.</p>
              )}
            </div>
          </section>
        </div>

        <section className="min-h-[500px] overflow-hidden rounded-xl border border-border lg:min-h-0">
          <RouteMapClient
            orders={orders.map((o) => ({
              id: o.id,
              lat: o.lat,
              lng: o.lng,
              address: o.address,
              status: o.status,
              assigned_rider_id: o.assigned_rider_id,
              sequence_in_route: o.sequence_in_route,
            }))}
            riders={riders.map((r) => ({
              id: r.id,
              depot_lat: r.depot_lat,
              depot_lng: r.depot_lng,
              name: r.profiles?.name ?? "Rider",
            }))}
          />
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-text-dim">{label}</p>
      <StatCounter value={value} decimals={0} className="font-display text-xl font-semibold" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-text-dim/20 text-text-dim",
    assigned: "bg-amber/20 text-amber",
    delivered: "bg-success/20 text-success",
    failed: "bg-danger/20 text-danger",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}
