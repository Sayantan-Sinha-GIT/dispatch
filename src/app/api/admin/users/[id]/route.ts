import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDispatchTick } from "@/lib/dispatch";

/**
 * Permanently deletes a customer or rider account.
 *
 * Delivery history is deliberately preserved — orders survive with a null
 * customer (the FK is ON DELETE SET NULL), because a business still needs its
 * completed-delivery record after someone closes their account. Any work the
 * account was mid-way through is released back to the pool first so it doesn't
 * strand in an assigned-to-nobody state.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ code: "admin_only", error: "Admin only" }, { status: 403 });
  }

  if (id === user.id) {
    return NextResponse.json(
      { code: "self_delete", error: "You can't delete your own admin account." },
      { status: 400 },
    );
  }

  const { data: target } = await admin.from("profiles").select("id, role, name").eq("id", id).maybeSingle();
  if (!target) {
    return NextResponse.json({ code: "not_found", error: "Account not found" }, { status: 404 });
  }
  if (target.role === "admin") {
    return NextResponse.json(
      { code: "cannot_delete_admin", error: "Admin accounts can't be deleted here." },
      { status: 400 },
    );
  }

  // Release any in-flight work before the account disappears.
  if (target.role === "rider") {
    const { data: rider } = await admin.from("riders").select("id").eq("profile_id", id).maybeSingle();
    if (rider) {
      await admin
        .from("orders")
        .update({
          status: "pending",
          assigned_rider_id: null,
          sequence_in_route: null,
          offered_at: null,
          accepted_at: null,
        })
        .eq("assigned_rider_id", rider.id)
        .in("status", ["offered", "assigned"]);
    }
  } else if (target.role === "customer") {
    await admin
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "admin",
        cancel_reason: "Customer account deleted",
        assigned_rider_id: null,
        sequence_in_route: null,
        offered_at: null,
        accepted_at: null,
      })
      .eq("customer_id", id)
      .in("status", ["pending", "offered", "assigned", "expired"]);
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    console.error("deleteUser failed", authError);
    return NextResponse.json(
      { code: "delete_failed", error: authError.message },
      { status: 500 },
    );
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_id: user.id,
    action: "delete_account",
    target_type: target.role,
    target_id: id,
    summary: `Deleted ${target.role} account "${target.name}"`,
    source: "ui",
  });
  if (auditError) console.error("admin_actions insert failed", auditError);

  await runDispatchTick(admin);

  return NextResponse.json({ ok: true });
}
