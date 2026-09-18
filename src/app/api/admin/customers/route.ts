import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Backs the admin Users tab: every customer and rider account, with activity stats. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ code: "admin_only", error: "Forbidden" }, { status: 403 });
  }

  const [{ data: customers }, { data: riderProfiles }, { data: riders }, { data: orders }] =
    await Promise.all([
      admin.from("profiles").select("*").eq("role", "customer").order("created_at", { ascending: false }),
      admin.from("profiles").select("*").eq("role", "rider").order("created_at", { ascending: false }),
      admin.from("riders").select("*"),
      admin.from("orders").select("customer_id, assigned_rider_id, total_amount, status"),
    ]);

  const customerStats = new Map<string, { count: number; spent: number; cancelled: number }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const s = customerStats.get(o.customer_id) ?? { count: 0, spent: 0, cancelled: 0 };
    s.count += 1;
    if (o.status === "delivered") s.spent += o.total_amount ?? 0;
    if (o.status === "cancelled") s.cancelled += 1;
    customerStats.set(o.customer_id, s);
  }

  const openByRider = new Map<string, number>();
  for (const o of orders ?? []) {
    if (o.assigned_rider_id && (o.status === "offered" || o.status === "assigned")) {
      openByRider.set(o.assigned_rider_id, (openByRider.get(o.assigned_rider_id) ?? 0) + 1);
    }
  }

  const ridersByProfile = new Map((riders ?? []).map((r) => [r.profile_id, r]));

  return NextResponse.json({
    customers: (customers ?? []).map((c) => ({
      ...c,
      order_count: customerStats.get(c.id)?.count ?? 0,
      total_spent: customerStats.get(c.id)?.spent ?? 0,
      cancelled_count: customerStats.get(c.id)?.cancelled ?? 0,
    })),
    riders: (riderProfiles ?? []).map((p) => {
      const r = ridersByProfile.get(p.id);
      return {
        ...p,
        rider_id: r?.id ?? null,
        rider_status: r?.status ?? null,
        capacity: r?.capacity ?? null,
        total_deliveries: r?.total_deliveries ?? 0,
        total_earnings: Number(r?.total_earnings ?? 0),
        total_penalties: r?.total_penalties ?? 0,
        total_declines: r?.total_declines ?? 0,
        suspended_until: r?.suspended_until ?? null,
        open_orders: r?.id ? (openByRider.get(r.id) ?? 0) : 0,
      };
    }),
  });
}
