import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelOrderAsAdmin,
  forceAssignOrderToRider,
  pullOrderFromRider,
  reassignRiderPendingOffers,
  runDispatchTick,
  SUSPENSION_MINUTES,
} from "@/lib/dispatch";
import {
  describeAction,
  isDestructive,
  planFromCommand,
  validateActions,
  type ConsoleAction,
  type OrderSnapshot,
  type RiderSnapshot,
} from "@/lib/adminConsole";

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadSnapshot(admin: AdminClient) {
  const [{ data: orders }, { data: riders }] = await Promise.all([
    admin
      .from("orders")
      .select("id, address, status, total_amount, created_at, riders(profiles(name)), profiles!orders_customer_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(80),
    admin.from("riders").select("*, profiles(name)"),
  ]);

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

  const orderSnapshot: OrderSnapshot[] = (orders ?? []).map((o) => ({
    id: o.id,
    address: o.address,
    status: o.status,
    riderName: (o.riders as { profiles?: { name: string } } | null)?.profiles?.name ?? null,
    customerName: (o.profiles as { name: string } | null)?.name ?? null,
    totalAmount: o.total_amount,
    createdAt: o.created_at,
  }));

  const riderSnapshot: RiderSnapshot[] = (riders ?? []).map((r) => ({
    id: r.id,
    name: (r.profiles as { name: string } | null)?.name ?? "Rider",
    status: r.status,
    capacity: r.capacity,
    openOrders: loadByRider.get(r.id) ?? 0,
    suspended: !!r.suspended_until && new Date(r.suspended_until).getTime() > Date.now(),
  }));

  return { orderSnapshot, riderSnapshot };
}

async function executeAction(
  admin: AdminClient,
  action: ConsoleAction,
): Promise<{ ok: boolean; message: string }> {
  switch (action.kind) {
    case "create_orders": {
      const rows = (action.orders ?? []).map((o) => ({
        raw_text: `Console: ${o.address}`,
        address: o.address,
        lat: o.lat,
        lng: o.lng,
        weight: o.weight ?? 1,
        time_window_start: o.time_window_start || null,
        time_window_end: o.time_window_end || null,
        status: "pending" as const,
        source: "admin" as const,
      }));
      const { error } = await admin.from("orders").insert(rows);
      if (error) return { ok: false, message: error.message };
      await runDispatchTick(admin);
      return { ok: true, message: `Created ${rows.length} order(s) and ran dispatch.` };
    }

    case "cancel_order": {
      const res = await cancelOrderAsAdmin(admin, action.orderId!, action.reason ?? undefined);
      if (!res.ok) return { ok: false, message: res.error };
      await runDispatchTick(admin);
      return { ok: true, message: `Cancelled "${res.address}".` };
    }

    case "delete_order": {
      const { data: order } = await admin
        .from("orders")
        .select("address, riders(profile_id)")
        .eq("id", action.orderId!)
        .maybeSingle();
      const riderProfile = (order?.riders as { profile_id?: string } | null)?.profile_id;
      const { error } = await admin.from("orders").delete().eq("id", action.orderId!);
      if (error) return { ok: false, message: error.message };
      if (riderProfile) {
        await admin.from("notifications").insert({
          profile_id: riderProfile,
          type: "order_cancelled",
          title: "Delivery cancelled",
          body: `"${order?.address}" was removed by an admin.`,
        });
      }
      return { ok: true, message: `Deleted "${order?.address ?? "order"}".` };
    }

    case "reassign_order": {
      const res = await pullOrderFromRider(admin, action.orderId!);
      if (!res.ok) return { ok: false, message: res.error };
      return { ok: true, message: `Moved "${res.address}" off its rider and re-planned it.` };
    }

    case "force_assign_order": {
      const res = await forceAssignOrderToRider(admin, action.orderId!, action.riderId!);
      if (!res.ok) return { ok: false, message: res.error };
      return { ok: true, message: `Sent "${res.address}" to ${res.riderName}.` };
    }

    case "mark_delivered":
    case "set_order_status": {
      // Both go through the same guarded function: it moves the order, keeps
      // delivered_at honest, and credits or un-credits the rider so a status
      // flipped in the console can't leave a rider paid for a delivery that is
      // back on the road.
      const target = action.kind === "mark_delivered" ? "delivered" : action.status!;
      const { data, error } = await admin.rpc("admin_set_order_status", {
        p_order_id: action.orderId!,
        p_status: target,
      });
      if (error) return { ok: false, message: error.message };
      const res = data as { ok?: boolean; error?: string; address?: string; previous?: string };
      if (!res?.ok) {
        const reasons: Record<string, string> = {
          not_found: "Order not found",
          no_rider: "That order has no rider, so it can't be set to assigned",
          already_in_status: `Order is already ${target}`,
          invalid_status: "Not a status an admin can set",
        };
        return { ok: false, message: reasons[res?.error ?? ""] ?? "Could not change that order's status" };
      }
      // Anything landing back in the pool should be re-planned immediately.
      if (target === "pending") await runDispatchTick(admin);
      return {
        ok: true,
        message: `"${res.address}" moved from ${res.previous} to ${target}.`,
      };
    }

    case "suspend_rider": {
      const minutes = Number(action.minutes ?? SUSPENSION_MINUTES);
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const { data: rider } = await admin
        .from("riders")
        .select("profile_id, profiles(name)")
        .eq("id", action.riderId!)
        .maybeSingle();

      const { error } = await admin
        .from("riders")
        .update({ suspended_until: until })
        .eq("id", action.riderId!);
      if (error) return { ok: false, message: error.message };
      // Their unaccepted offers go to someone who can take them now.
      await reassignRiderPendingOffers(admin, action.riderId!);

      if (rider?.profile_id) {
        await admin.from("notifications").insert({
          profile_id: rider.profile_id,
          type: "penalty",
          title: "You've been suspended",
          body: `An admin suspended you from new offers for ${minutes} minutes.`,
        });
      }
      await runDispatchTick(admin);
      const name = (rider?.profiles as { name: string } | null)?.name ?? "Rider";
      return { ok: true, message: `Suspended ${name} for ${minutes} minutes.` };
    }

    case "unsuspend_rider": {
      const { data: rider } = await admin
        .from("riders")
        .select("profile_id, profiles(name)")
        .eq("id", action.riderId!)
        .maybeSingle();
      const { error } = await admin
        .from("riders")
        .update({ suspended_until: null, consecutive_missed_offers: 0 })
        .eq("id", action.riderId!);
      if (error) return { ok: false, message: error.message };
      if (rider?.profile_id) {
        await admin.from("notifications").insert({
          profile_id: rider.profile_id,
          type: "rider_status",
          title: "Suspension lifted",
          body: "You're eligible for new delivery offers again.",
        });
      }
      await runDispatchTick(admin);
      const name = (rider?.profiles as { name: string } | null)?.name ?? "Rider";
      return { ok: true, message: `Lifted ${name}'s suspension.` };
    }

    case "set_rider_capacity": {
      const { error } = await admin
        .from("riders")
        .update({ capacity: Number(action.capacity) })
        .eq("id", action.riderId!);
      if (error) return { ok: false, message: error.message };
      await runDispatchTick(admin);
      return { ok: true, message: `Capacity set to ${action.capacity}.` };
    }

    case "run_dispatch": {
      const res = await runDispatchTick(admin);
      return {
        ok: true,
        message: `Dispatch run — ${res.assigned} order(s) offered, ${res.expired} stale offer(s) retired.`,
      };
    }

    case "answer":
      return { ok: true, message: action.text ?? "" };

    default:
      return { ok: false, message: `Unsupported action: ${action.kind}` };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ code: "admin_only", error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json()) as {
    command?: string;
    confirm?: boolean;
    actions?: ConsoleAction[];
  };

  const { orderSnapshot, riderSnapshot } = await loadSnapshot(admin);

  // ---- Confirm pass: execute the destructive actions the admin approved ----
  if (body.confirm && Array.isArray(body.actions)) {
    const { valid, rejected } = validateActions(body.actions, orderSnapshot, riderSnapshot);
    const results: { label: string; ok: boolean; message: string }[] = [];

    for (const action of valid) {
      const label = describeAction(action, orderSnapshot, riderSnapshot);
      const res = await executeAction(admin, action);
      results.push({ label, ...res });
      const { error: auditError } = await admin.from("admin_actions").insert({
        admin_id: user.id,
        action: action.kind,
        target_type: action.orderId ? "order" : action.riderId ? "rider" : null,
        target_id: action.orderId ?? action.riderId ?? null,
        summary: `${label} — ${res.ok ? "done" : `failed: ${res.message}`}`,
        source: "gemini",
      });
      if (auditError) console.error("admin_actions insert failed", auditError);
    }

    return NextResponse.json({ results, rejected, pending: [] });
  }

  // ---- Plan pass ----
  const command = (body.command ?? "").trim();
  if (!command) {
    return NextResponse.json({ code: "empty_command", error: "Type a command first" }, { status: 400 });
  }

  let plan;
  try {
    plan = await planFromCommand(command, orderSnapshot, riderSnapshot);
  } catch (err) {
    console.error("Console planning failed", err);
    return NextResponse.json(
      { code: "planning_failed", error: "Could not understand that — try rephrasing." },
      { status: 502 },
    );
  }

  const { valid, rejected } = validateActions(plan.actions, orderSnapshot, riderSnapshot);

  const pending = valid.filter((a) => isDestructive(a.kind));
  const immediate = valid.filter((a) => !isDestructive(a.kind));

  const results: { label: string; ok: boolean; message: string }[] = [];
  for (const action of immediate) {
    const label = describeAction(action, orderSnapshot, riderSnapshot);
    const res = await executeAction(admin, action);
    results.push({ label, ...res });
    if (action.kind !== "answer") {
      const { error: auditError } = await admin.from("admin_actions").insert({
        admin_id: user.id,
        action: action.kind,
        target_type: action.orderId ? "order" : action.riderId ? "rider" : null,
        target_id: action.orderId ?? action.riderId ?? null,
        summary: `${label} — ${res.ok ? "done" : `failed: ${res.message}`}`,
        source: "gemini",
        raw_command: command,
      });
      if (auditError) console.error("admin_actions insert failed", auditError);
    }
  }

  return NextResponse.json({
    reply: plan.reply,
    results,
    rejected,
    pending: pending.map((a) => ({
      action: a,
      label: describeAction(a, orderSnapshot, riderSnapshot),
    })),
  });
}
