import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm } from "@/lib/routing/haversine";
import { optimizeRoutes } from "@/lib/routing/optimizer";
import { quotePayout } from "@/lib/pricing";
import { isWithinServiceRange } from "@/lib/serviceArea";
import type { RoutingOrder, RoutingRider } from "@/lib/routing/types";
import type { Database } from "@/lib/supabase/types";

export const OFFER_TIMEOUT_MS = 5 * 60 * 1000;
export const PENALTY_THRESHOLD = 3;
export const SUSPENSION_MINUTES = 30;
/** How fresh a GPS ping must be to route from the rider's live position instead of their depot. */
const LIVE_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;

type AdminClient = SupabaseClient<Database>;
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type RiderRow = Database["public"]["Tables"]["riders"]["Row"];

/** Where a rider is dispatched from right now: live GPS if recent, else their depot. */
export function riderOrigin(rider: RiderRow) {
  const fresh =
    rider.location_updated_at &&
    Date.now() - new Date(rider.location_updated_at).getTime() < LIVE_LOCATION_MAX_AGE_MS;

  if (fresh && rider.current_lat != null && rider.current_lng != null) {
    return { lat: rider.current_lat, lng: rider.current_lng };
  }
  return { lat: rider.depot_lat, lng: rider.depot_lng };
}

function isSuspended(rider: { suspended_until: string | null }) {
  return !!rider.suspended_until && new Date(rider.suspended_until).getTime() > Date.now();
}

async function logOrderEvent(
  admin: AdminClient,
  orderId: string,
  eventType: string,
  actorRole: string,
  detail: string,
  actorId?: string | null,
) {
  const { error } = await admin.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    actor_role: actorRole,
    actor_id: actorId ?? null,
    detail,
  });
  // Audit writes must never break dispatch, but they must not vanish quietly
  // either — a silent failure here is how a whole table stayed empty unnoticed.
  if (error) console.error("order_events insert failed", error);
}

async function notify(
  admin: AdminClient,
  profileId: string,
  type: string,
  title: string,
  body: string,
  relatedOrderId?: string,
) {
  await admin.from("notifications").insert({
    profile_id: profileId,
    type,
    title,
    body,
    related_order_id: relatedOrderId,
  });
}

async function notifyAllAdmins(admin: AdminClient, type: string, title: string, body: string) {
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) {
    await notify(admin, a.id, type, title, body);
  }
}

/** Active, unsuspended riders with their currently-open order count. */
async function loadAvailableRiders(admin: AdminClient, excludeRiderId?: string) {
  const { data: riders } = await admin
    .from("riders")
    .select("*, profiles(name)")
    .eq("status", "active");

  const eligible = (riders ?? []).filter(
    (r) => !isSuspended(r) && (!excludeRiderId || r.id !== excludeRiderId),
  );
  if (eligible.length === 0) return { riders: [], loadByRider: new Map<string, number>() };

  const { data: openOrders } = await admin
    .from("orders")
    .select("assigned_rider_id")
    .in("status", ["offered", "assigned"]);

  const loadByRider = new Map<string, number>();
  for (const o of openOrders ?? []) {
    if (o.assigned_rider_id) {
      loadByRider.set(o.assigned_rider_id, (loadByRider.get(o.assigned_rider_id) ?? 0) + 1);
    }
  }

  return { riders: eligible, loadByRider };
}

/** Finds the nearest eligible rider with spare capacity for a single order. */
async function findReplacementRider(
  admin: AdminClient,
  order: { lat: number; lng: number },
  excludeRiderId: string,
) {
  const { riders, loadByRider } = await loadAvailableRiders(admin, excludeRiderId || undefined);

  const withCapacity = riders.filter((r) => (loadByRider.get(r.id) ?? 0) < r.capacity);
  if (withCapacity.length === 0) return null;

  let best: (typeof withCapacity)[number] | null = null;
  let bestDist = Infinity;
  for (const rider of withCapacity) {
    const dist = haversineDistanceKm(riderOrigin(rider), order);
    if (dist < bestDist) {
      bestDist = dist;
      best = rider;
    }
  }

  // Nearest is not the same as near enough. If the closest rider with room is
  // still outside the service radius, the order waits rather than travelling.
  if (!best || !isWithinServiceRange(bestDist)) return null;

  return { rider: best, sequenceBase: loadByRider.get(best.id) ?? 0, distanceKm: bestDist };
}

/**
 * Claims `order` for `rider` via the `claim_order_for_rider` Postgres function,
 * which re-checks capacity and performs the status transition in one atomic,
 * row-locked statement. Two concurrent offers targeting the same rider serialize
 * on the rider row lock instead of both succeeding.
 *
 * The payout quote is persisted as part of the same claim, so the figure shown
 * in the rider's offer popup is exactly what gets credited on delivery.
 *
 * Returns false (notifying nobody) if the order left `fromStatus` or the rider
 * filled up first — callers should leave it for the next dispatch tick.
 */
export async function offerOrderToRider(
  admin: AdminClient,
  order: { id: string; address: string; lat: number; lng: number; weight: number },
  rider: { id: string; profile_id: string },
  sequence: number,
  fromStatus: string = "pending",
  distanceKm?: number,
) {
  const quote = quotePayout(order.weight, distanceKm ?? 0);

  const { data: claimed, error } = await admin.rpc("claim_order_for_rider", {
    p_order_id: order.id,
    p_rider_id: rider.id,
    p_sequence: sequence,
    p_from_status: fromStatus,
    p_payout: quote.total,
    p_distance_km: quote.distanceKm,
  });

  if (error) {
    console.error("claim_order_for_rider failed", error);
    return false;
  }
  if (!claimed) return false;

  await notify(
    admin,
    rider.profile_id,
    "delivery_offer",
    "New delivery request",
    `${order.address} — ₹${quote.total} for ${quote.distanceKm} km. Accept within 5 minutes.`,
    order.id,
  );
  await logOrderEvent(
    admin,
    order.id,
    "offered",
    "system",
    `Offered to a rider — ₹${quote.total} quoted for ${quote.distanceKm} km`,
  );
  return true;
}

/**
 * Runs the vehicle-routing optimizer across every pending order and every
 * rider with spare capacity, then offers each computed stop.
 *
 * This is the single path by which orders reach riders — checkout, the periodic
 * tick, a rider coming online and the admin's manual button all funnel through
 * here, so every assignment is the product of the routing algorithm rather than
 * a first-come-first-served grab.
 */
export async function assignPendingOrders(admin: AdminClient) {
  const { data: pendingOrders } = await admin.from("orders").select("*").eq("status", "pending");
  if (!pendingOrders || pendingOrders.length === 0) {
    return {
      assigned: 0,
      considered: 0,
      totalDistanceKm: 0,
      baselineDistanceKm: 0,
      noRiders: false,
      outOfRange: 0,
    };
  }

  const { riders, loadByRider } = await loadAvailableRiders(admin);
  const withCapacity = riders.filter((r) => (loadByRider.get(r.id) ?? 0) < r.capacity);

  if (withCapacity.length === 0) {
    return {
      assigned: 0,
      considered: pendingOrders.length,
      totalDistanceKm: 0,
      baselineDistanceKm: 0,
      noRiders: true,
      outOfRange: 0,
    };
  }

  // Orders with no rider inside the service radius are dropped before routing,
  // not after: feeding a 1500 km stop to the solver drags the whole plan toward
  // it and produces routes nobody can ride.
  const riderOrigins = withCapacity.map((r) => riderOrigin(r));
  const reachable = pendingOrders.filter((o) =>
    riderOrigins.some((origin) => isWithinServiceRange(haversineDistanceKm(origin, o))),
  );
  const outOfRange = pendingOrders.length - reachable.length;

  if (reachable.length === 0) {
    return {
      assigned: 0,
      considered: pendingOrders.length,
      totalDistanceKm: 0,
      baselineDistanceKm: 0,
      noRiders: false,
      outOfRange,
    };
  }

  const routingOrders: RoutingOrder[] = reachable.map((o) => ({
    id: o.id,
    lat: o.lat,
    lng: o.lng,
    weight: o.weight,
  }));

  // Capacity passed to the solver is *remaining* capacity, so riders already
  // holding work don't get planned past their limit.
  const routingRiders: RoutingRider[] = withCapacity.map((r) => {
    const origin = riderOrigin(r);
    return {
      id: r.id,
      capacity: r.capacity - (loadByRider.get(r.id) ?? 0),
      depotLat: origin.lat,
      depotLng: origin.lng,
    };
  });

  const result = optimizeRoutes(routingOrders, routingRiders);
  const ordersById = new Map(reachable.map((o) => [o.id, o]));
  const ridersById = new Map(withCapacity.map((r) => [r.id, r]));

  let assigned = 0;
  for (const route of result.routes) {
    const rider = ridersById.get(route.riderId);
    if (!rider) continue;
    const origin = riderOrigin(rider);
    const base = loadByRider.get(rider.id) ?? 0;

    for (const stop of route.stops) {
      const order = ordersById.get(stop.orderId);
      if (!order) continue;
      const distanceKm = haversineDistanceKm(origin, order);
      // The solver may still route a reachable order to a rider who is not the
      // near one, so the radius is re-checked per offer, not just per order.
      if (!isWithinServiceRange(distanceKm)) continue;
      const ok = await offerOrderToRider(
        admin,
        order,
        rider,
        base + stop.sequence,
        "pending",
        distanceKm,
      );
      if (ok) assigned += 1;
    }
  }

  return {
    assigned,
    considered: pendingOrders.length,
    totalDistanceKm: result.totalDistanceKm,
    baselineDistanceKm: result.naiveBaselineDistanceKm,
    noRiders: false,
    outOfRange,
  };
}

/**
 * Processes orders stuck in "offered" past the acceptance window. Penalizes the
 * non-responding rider after repeated misses and returns the order to the pool.
 *
 * The claim step (offered -> expired) is a single atomic UPDATE...WHERE, so
 * concurrent ticks can never both grab the same order.
 */
export async function sweepExpiredOffers(admin: AdminClient) {
  const cutoff = new Date(Date.now() - OFFER_TIMEOUT_MS).toISOString();
  const { data: claimed } = await admin
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "offered")
    .lt("offered_at", cutoff)
    .select("*");

  for (const order of claimed ?? []) {
    await reassignOrExpire(admin, order, { penalize: true });
  }

  return claimed?.length ?? 0;
}

/**
 * One dispatch cycle: retire stale offers, then re-plan every pending order.
 * Called on checkout, when a rider comes online, on the dashboards' poll, and
 * from the admin's manual re-optimize.
 */
export async function runDispatchTick(admin: AdminClient) {
  const expired = await sweepExpiredOffers(admin);
  const assignment = await assignPendingOrders(admin);
  return { expired, ...assignment };
}

/**
 * Immediately hands off a rider's still-unaccepted offers when they go offline
 * or explicitly decline, without penalizing them.
 */
export async function reassignRiderPendingOffers(
  admin: AdminClient,
  riderId: string,
  orderId?: string,
) {
  let query = admin
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "offered")
    .eq("assigned_rider_id", riderId);

  if (orderId) query = query.eq("id", orderId);

  const { data: claimed } = await query.select("*");

  for (const order of claimed ?? []) {
    await reassignOrExpire(admin, order, { penalize: false, excludeRiderId: riderId });
  }

  return claimed?.length ?? 0;
}

/** Re-plans an order that has already been atomically moved out of "offered". */
export async function reassignOrExpire(
  admin: AdminClient,
  order: OrderRow,
  opts: { penalize: boolean; excludeRiderId?: string },
) {
  const missedRiderId = opts.excludeRiderId ?? order.assigned_rider_id;

  if (opts.penalize && missedRiderId) {
    const { data: rows, error: rpcError } = await admin.rpc("register_missed_offer", {
      p_rider_id: missedRiderId,
      p_threshold: PENALTY_THRESHOLD,
      p_suspension_minutes: SUSPENSION_MINUTES,
    });
    if (rpcError) console.error("register_missed_offer failed", rpcError);
    const result = rows?.[0];
    if (result?.profile_id) {
      if (result.penalized) {
        await notify(
          admin,
          result.profile_id,
          "penalty",
          "You've been penalized",
          `${PENALTY_THRESHOLD} missed deliveries in a row — you're suspended from new offers for ${SUSPENSION_MINUTES} minutes.`,
        );
        await notifyAllAdmins(
          admin,
          "rider_penalized",
          "Rider penalized",
          `${result.rider_name ?? "A rider"} was suspended after ${PENALTY_THRESHOLD} missed deliveries.`,
        );
        // Anything else still waiting on them would only time out too, one
        // five-minute wait (and one more "miss") at a time. Hand it on now.
        await reassignRiderPendingOffers(admin, missedRiderId);
      } else {
        await notify(
          admin,
          result.profile_id,
          "missed_offer",
          "Delivery request expired",
          `You didn't accept "${order.address}" in time. ${PENALTY_THRESHOLD - result.missed} more miss(es) before a penalty.`,
        );
      }
    }
  }

  const replacement = missedRiderId
    ? await findReplacementRider(admin, order, missedRiderId)
    : await findReplacementRider(admin, order, "");

  const claimed = replacement
    ? await offerOrderToRider(
        admin,
        order,
        replacement.rider,
        replacement.sequenceBase,
        "expired",
        replacement.distanceKm,
      )
    : false;

  if (claimed && replacement) {
    await notifyAllAdmins(
      admin,
      "order_reassigned",
      "Order reassigned",
      `"${order.address}" was reassigned to ${(replacement.rider as { profiles?: { name: string } }).profiles?.name ?? "another rider"}.`,
    );
  } else {
    await admin
      .from("orders")
      .update({
        status: "pending",
        assigned_rider_id: null,
        sequence_in_route: null,
        offered_at: null,
        accepted_at: null,
      })
      .eq("id", order.id);
    await notifyAllAdmins(
      admin,
      "order_unassigned",
      "Order back in the pool",
      `"${order.address}" has no available rider right now and returned to pending.`,
    );
  }
}

/**
 * Admin override for an order stuck with a rider who went dark: takes it off
 * them and offers it to the nearest *other* rider with room, or returns it to
 * the pool if there is none. Only an order that is actually with a rider can
 * be pulled; a delivered or cancelled one is left alone.
 */
export async function pullOrderFromRider(admin: AdminClient, orderId: string) {
  const { data: order } = await admin
    .from("orders")
    .select("*, riders(profile_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false as const, code: "not_found", error: "Order not found" };

  // Parked in "expired" (atomically, and only from a rider's hands) so the
  // re-offer below can claim it exactly as a timed-out offer is claimed.
  const { data: moved } = await admin
    .from("orders")
    .update({ status: "expired", sequence_in_route: null, offered_at: null, accepted_at: null })
    .eq("id", orderId)
    .in("status", ["offered", "assigned"])
    .select("*")
    .maybeSingle();
  if (!moved) return { ok: false as const, code: "not_with_rider", error: "This order isn't with a rider right now" };

  const riderProfileId = (order.riders as { profile_id?: string } | null)?.profile_id;
  if (riderProfileId) {
    await notify(
      admin,
      riderProfileId,
      "order_reassigned_away",
      "Delivery reassigned",
      `An admin moved "${order.address}" off your queue — no need to deliver it.`,
    );
  }
  await logOrderEvent(admin, orderId, "reassigned", "admin", "Pulled from its rider by an admin");
  await reassignOrExpire(admin, moved, {
    penalize: false,
    excludeRiderId: order.assigned_rider_id ?? undefined,
  });
  return { ok: true as const, address: order.address };
}

/**
 * Force-assigns an order to a specific rider, bypassing the optimizer. Used by
 * the admin console ("send order X to rider Y") — capacity is still enforced by
 * the claim function, so this can't silently overload someone.
 */
export async function forceAssignOrderToRider(
  admin: AdminClient,
  orderId: string,
  riderId: string,
) {
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false as const, error: "Order not found" };
  if (order.status === "delivered") return { ok: false as const, error: "Order is already delivered" };
  if (order.status === "cancelled") return { ok: false as const, error: "Order is cancelled" };

  const { data: rider } = await admin
    .from("riders")
    .select("*, profiles(name)")
    .eq("id", riderId)
    .maybeSingle();
  if (!rider) return { ok: false as const, error: "Rider not found" };

  const previousRiderId = order.assigned_rider_id;

  // Park it in a neutral state first so the claim's from-status guard has a
  // predictable starting point regardless of where the order was.
  await admin
    .from("orders")
    .update({
      status: "pending",
      assigned_rider_id: null,
      sequence_in_route: null,
      offered_at: null,
      accepted_at: null,
    })
    .eq("id", orderId);

  const distanceKm = haversineDistanceKm(riderOrigin(rider), order);
  const ok = await offerOrderToRider(
    admin,
    order,
    rider,
    0,
    "pending",
    distanceKm,
  );

  if (!ok) {
    return { ok: false as const, error: "That rider is at capacity right now" };
  }

  if (previousRiderId && previousRiderId !== riderId) {
    const { data: prev } = await admin
      .from("riders")
      .select("profile_id")
      .eq("id", previousRiderId)
      .maybeSingle();
    if (prev?.profile_id) {
      await notify(
        admin,
        prev.profile_id,
        "order_reassigned_away",
        "Delivery reassigned",
        `An admin moved "${order.address}" to another rider.`,
      );
    }
  }

  const riderName = (rider as { profiles?: { name: string } }).profiles?.name ?? "a rider";
  await logOrderEvent(admin, orderId, "force_assigned", "admin", `Force-assigned to ${riderName}`);

  return { ok: true as const, riderName, address: order.address };
}

/** Admin-side cancellation — no time window, unlike the customer's 3-minute one. */
export async function cancelOrderAsAdmin(admin: AdminClient, orderId: string, reason?: string) {
  const { data: order } = await admin
    .from("orders")
    .select("*, riders(profile_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false as const, error: "Order not found" };
  if (order.status === "cancelled") return { ok: false as const, error: "Order is already cancelled" };

  // The same guarded function as every other admin status change, so
  // cancelling an order that was already delivered also takes back the
  // rider's credit for it. (Its goods are not restocked: they left the store.)
  const { data, error } = await admin.rpc("admin_set_order_status", {
    p_order_id: orderId,
    p_status: "cancelled",
  });
  const res = data as { ok?: boolean; error?: string } | null;
  if (error || !res?.ok) return { ok: false as const, error: error?.message ?? res?.error ?? "Could not cancel" };
  if (reason) await admin.from("orders").update({ cancel_reason: reason }).eq("id", orderId);

  const riderProfileId = (order.riders as { profile_id?: string } | null)?.profile_id;
  if (riderProfileId) {
    await notify(
      admin,
      riderProfileId,
      "order_cancelled",
      "Delivery cancelled",
      order.status === "delivered"
        ? `An admin cancelled "${order.address}" after delivery; its ₹${order.payout_amount ?? 0} payout was reversed.`
        : `"${order.address}" was cancelled by an admin — no need to deliver it.`,
    );
  }
  if (order.customer_id) {
    await notify(
      admin,
      order.customer_id,
      "order_cancelled",
      "Your order was cancelled",
      reason
        ? `"${order.address}" was cancelled by support: ${reason}`
        : `"${order.address}" was cancelled by support.`,
      orderId,
    );
  }

  if (reason) await logOrderEvent(admin, orderId, "cancelled", "admin", `Cancelled by admin — ${reason}`);

  return { ok: true as const, address: order.address };
}
