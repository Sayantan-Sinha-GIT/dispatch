import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm } from "@/lib/routing/haversine";
import type { Database } from "@/lib/supabase/types";

const OFFER_TIMEOUT_MS = 5 * 60 * 1000;
const PENALTY_THRESHOLD = 3;
const SUSPENSION_MINUTES = 30;

type AdminClient = SupabaseClient<Database>;
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

/** Finds the nearest eligible active rider (under capacity, not suspended, not excluded) for an order. */
async function findReplacementRider(
  admin: AdminClient,
  order: { lat: number; lng: number },
  excludeRiderId: string,
) {
  const { data: candidates } = await admin
    .from("riders")
    .select("*, profiles(name)")
    .eq("status", "active")
    .neq("id", excludeRiderId);

  if (!candidates || candidates.length === 0) return null;

  const eligible = candidates.filter(
    (r) => !r.suspended_until || new Date(r.suspended_until).getTime() < Date.now(),
  );
  if (eligible.length === 0) return null;

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

  const withCapacity = eligible.filter((r) => (loadByRider.get(r.id) ?? 0) < r.capacity);
  if (withCapacity.length === 0) return null;

  let best = withCapacity[0];
  let bestDist = Infinity;
  for (const rider of withCapacity) {
    const from =
      rider.current_lat != null && rider.current_lng != null
        ? { lat: rider.current_lat, lng: rider.current_lng }
        : { lat: rider.depot_lat, lng: rider.depot_lng };
    const dist = haversineDistanceKm(from, order);
    if (dist < bestDist) {
      bestDist = dist;
      best = rider;
    }
  }

  return { rider: best, sequenceBase: loadByRider.get(best.id) ?? 0 };
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

export async function offerOrderToRider(
  admin: AdminClient,
  order: { id: string; address: string; lat: number; lng: number },
  rider: { id: string; profile_id: string },
  sequence: number,
) {
  await admin
    .from("orders")
    .update({
      assigned_rider_id: rider.id,
      sequence_in_route: sequence,
      status: "offered",
      offered_at: new Date().toISOString(),
      accepted_at: null,
    })
    .eq("id", order.id);

  await notify(
    admin,
    rider.profile_id,
    "delivery_offer",
    "New delivery request",
    `${order.address} — accept within 5 minutes or it goes to another rider.`,
    order.id,
  );
}

/**
 * Processes orders stuck in "offered" past the acceptance window. Penalizes
 * the non-responding rider after repeated misses and hands the order to the
 * next nearest active rider, or back to the pending pool if none are free.
 *
 * The claim step (offered -> expired) is a single atomic UPDATE...WHERE, so
 * concurrent sweep calls (each dashboard polls independently) can never both
 * grab the same order — whichever commits first flips the status out of
 * "offered" and the other's WHERE clause simply stops matching that row.
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
 * Immediately hands off a rider's still-unaccepted offers when they go
 * offline, without penalizing them (a deliberate status change isn't a miss).
 * Same atomic claim pattern as the timeout sweep.
 */
export async function reassignRiderPendingOffers(admin: AdminClient, riderId: string) {
  const { data: claimed } = await admin
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "offered")
    .eq("assigned_rider_id", riderId)
    .select("*");

  for (const order of claimed ?? []) {
    await reassignOrExpire(admin, order, { penalize: false, excludeRiderId: riderId });
  }

  return claimed?.length ?? 0;
}

async function reassignOrExpire(
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

  if (replacement) {
    await offerOrderToRider(admin, order, replacement.rider, replacement.sequenceBase);
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
