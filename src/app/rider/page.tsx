"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { RouteMapClient } from "@/components/RouteMapClient";
import type { Tables } from "@/lib/supabase/types";

type Order = Tables<"orders">;
type Rider = Tables<"riders">;

export default function RiderDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [rider, setRider] = useState<Rider | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    if (profile) setName(profile.name);

    const { data: riderRow } = await supabase.from("riders").select("*").eq("profile_id", user.id).single();
    if (!riderRow) return;
    setRider(riderRow);

    const { data: myOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_rider_id", riderRow.id)
      .order("sequence_in_route", { ascending: true });
    if (myOrders) setOrders(myOrders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount, standard data-fetch pattern
    loadData();
    const channel = supabase
      .channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  useEffect(() => {
    if (!rider || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        supabase.rpc("update_my_location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // permission denied or unavailable — live tracking just stays off
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/rider/login");
    router.refresh();
  }

  async function markDelivered(orderId: string) {
    await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
    loadData();
  }

  const remaining = orders.filter((o) => o.status !== "delivered");
  const done = orders.filter((o) => o.status === "delivered");

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs text-text-dim">Today&apos;s route</p>
          <h1 className="font-display text-lg font-semibold">{name || "Rider"}</h1>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-dim"
        >
          Sign out
        </button>
      </header>

      <div className="h-64 border-b border-border">
        {rider && (
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
            riders={[
              {
                id: rider.id,
                depot_lat: rider.depot_lat,
                depot_lng: rider.depot_lng,
                name,
                current_lat: rider.current_lat,
                current_lng: rider.current_lng,
              },
            ]}
            showLocateMe
          />
        )}
      </div>

      <main className="space-y-3 p-4">
        <p className="text-sm text-text-dim">
          {remaining.length} stop{remaining.length !== 1 ? "s" : ""} remaining
        </p>

        {remaining.map((order, idx) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/20 font-display text-sm font-semibold text-amber">
              {(order.sequence_in_route ?? idx) + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{order.address}</p>
              <p className="text-xs text-text-dim">{order.weight} kg</p>
            </div>
            <button
              onClick={() => markDelivered(order.id)}
              className="shrink-0 rounded-lg bg-success/20 px-3 py-2.5 text-xs font-semibold text-success active:scale-95"
            >
              Delivered
            </button>
          </motion.div>
        ))}

        {remaining.length === 0 && orders.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center text-sm text-success">
            All stops delivered. Nice work!
          </div>
        )}

        {orders.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-dim">
            No route assigned yet.
          </div>
        )}

        {done.length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-xs text-text-dim">
              {done.length} delivered
            </summary>
            <div className="mt-2 space-y-1.5">
              {done.map((order) => (
                <div key={order.id} className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-dim line-through">
                  {order.address}
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
