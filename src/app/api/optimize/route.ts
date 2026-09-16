import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { optimizeRoutes } from "@/lib/routing/optimizer";
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

  const [{ data: pendingOrders, error: ordersError }, { data: riders, error: ridersError }] =
    await Promise.all([
      supabase.from("orders").select("*").in("status", ["pending", "assigned"]),
      supabase.from("riders").select("*"),
    ]);

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  if (ridersError) return NextResponse.json({ error: ridersError.message }, { status: 500 });

  if (!riders || riders.length === 0) {
    return NextResponse.json({ error: "No riders configured" }, { status: 400 });
  }

  const routingOrders: RoutingOrder[] = (pendingOrders ?? []).map((o) => ({
    id: o.id,
    lat: o.lat,
    lng: o.lng,
    weight: o.weight,
  }));
  const routingRiders: RoutingRider[] = riders.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    depotLat: r.depot_lat,
    depotLng: r.depot_lng,
  }));

  const result = optimizeRoutes(routingOrders, routingRiders);

  // Persist assignments + sequence back onto orders
  const updates = result.routes.flatMap((route) =>
    route.stops.map((stop) =>
      supabase
        .from("orders")
        .update({
          assigned_rider_id: route.riderId,
          sequence_in_route: stop.sequence,
          status: "assigned",
        })
        .eq("id", stop.orderId),
    ),
  );
  await Promise.all(updates);

  const { error: runError } = await supabase.from("optimization_runs").insert({
    run_by: user.id,
    total_distance_before: result.naiveBaselineDistanceKm,
    total_distance_after: result.totalDistanceKm,
    algorithm_used: "nearest_neighbor_2opt",
  });
  if (runError) console.error("Failed to log optimization run", runError);

  return NextResponse.json({ result });
}
