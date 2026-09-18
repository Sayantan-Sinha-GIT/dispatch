import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select("address, status, assigned_rider_id, riders(profile_id)")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignedProfileId = (order?.riders as { profile_id?: string } | null)?.profile_id;
  if (assignedProfileId && (order?.status === "offered" || order?.status === "assigned")) {
    await admin.from("notifications").insert({
      profile_id: assignedProfileId,
      type: "order_cancelled",
      title: "Delivery cancelled",
      body: `"${order?.address}" was cancelled by an admin — no need to deliver it.`,
    });
  }

  return NextResponse.json({ ok: true });
}
