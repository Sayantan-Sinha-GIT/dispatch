import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin manual override for an order stuck with a rider who went dark
// mid-delivery (offline without completing it, or simply unresponsive).
// Unlike the automatic sweep, this always applies — regardless of current
// status — since an admin is making a deliberate call here.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("address, status, riders(profile_id)")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const assignedProfileId = (order.riders as { profile_id?: string } | null)?.profile_id;

  const { error } = await admin
    .from("orders")
    .update({
      status: "pending",
      assigned_rider_id: null,
      sequence_in_route: null,
      offered_at: null,
      accepted_at: null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assignedProfileId) {
    await admin.from("notifications").insert({
      profile_id: assignedProfileId,
      type: "order_reassigned_away",
      title: "Delivery reassigned",
      body: `An admin pulled "${order.address}" from your queue and put it back in the pending pool.`,
    });
  }

  return NextResponse.json({ ok: true });
}
