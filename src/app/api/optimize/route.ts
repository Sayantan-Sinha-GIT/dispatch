import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { optimizeRoutes } from "@/lib/routing/optimizer";
import { offerOrderToRider } from "@/lib/dispatch";
import type { RoutingOrder, RoutingRider } from "@/lib/routing/types";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: pendingOrders, error: ordersError }, { data: riders, error: ridersError }] =
    await Promise.all([
      admin.from("orders").select("*").eq("status", "pending"),
      admin.from("riders").select("*, profiles(name)").eq("status", "active"),
    ]);

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  if (ridersError) return NextResponse.json({ error: ridersError.message }, { status: 500 });

  const eligibleRiders = (riders ?? []).filter(
    (r) => !r.suspended_until || new Date(r.suspended_until).getTime() < Date.now(),
  );

  if (eligibleRiders.length === 0) {
    return NextResponse.json({ error: "No active riders available" }, { status: 400 });
  }
  if (!pendingOrders || pendingOrders.length === 0) {
    return NextResponse.json({ error: "No pending orders to assign" }, { status: 400 });
  }

  const routingOrders: RoutingOrder[] = pendingOrders.map((o) => ({
    id: o.id,
    lat: o.lat,
    lng: o.lng,
    weight: o.weight,
  }));
  const routingRiders: RoutingRider[] = eligibleRiders.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    depotLat: r.depot_lat,
    depotLng: r.depot_lng,
  }));

  const result = optimizeRoutes(routingOrders, routingRiders);
  const ordersById = new Map(pendingOrders.map((o) => [o.id, o]));
  const ridersById = new Map(eligibleRiders.map((r) => [r.id, r]));

  await Promise.all(
    result.routes.flatMap((route) => {
      const rider = ridersById.get(route.riderId);
      if (!rider) return [];
      return route.stops.map((stop) => {
        const order = ordersById.get(stop.orderId);
        if (!order) return Promise.resolve();
        return offerOrderToRider(admin, order, rider, stop.sequence);
      });
    }),
  );

  const { error: runError } = await admin.from("optimization_runs").insert({
    run_by: user.id,
    total_distance_before: result.naiveBaselineDistanceKm,
    total_distance_after: result.totalDistanceKm,
    algorithm_used: "nearest_neighbor_2opt",
  });
  if (runError) console.error("Failed to log optimization run", runError);

  return NextResponse.json({ result, unassignedOrderIds: result.unassignedOrderIds });
}
