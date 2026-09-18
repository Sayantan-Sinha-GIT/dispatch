import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDispatchTick } from "@/lib/dispatch";

const ERROR_CODES: Record<string, string> = {
  not_found: "We couldn't find that order.",
  already_cancelled: "That order is already cancelled.",
  already_delivered: "That order has already been delivered.",
  window_expired: "The free-cancellation window has closed for this order.",
};

/**
 * Customer self-cancel. The 3-minute window and the ownership check both live
 * inside the `cancel_my_order` function so they're enforced atomically against
 * a rider accepting at the same moment.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase.rpc("cancel_my_order", { p_order_id: id });
  if (error) {
    console.error("cancel_my_order failed", error);
    return NextResponse.json({ code: "cancel_failed", error: "Could not cancel that order." }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; rider_profile_id?: string; address?: string };

  if (!result?.ok) {
    const code = result?.error ?? "cancel_failed";
    return NextResponse.json(
      { code, error: ERROR_CODES[code] ?? "Could not cancel that order." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (result.rider_profile_id) {
    await admin.from("notifications").insert({
      profile_id: result.rider_profile_id,
      type: "order_cancelled",
      title: "Delivery cancelled",
      body: `The customer cancelled "${result.address}" — no need to deliver it.`,
    });
  }

  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) {
    await admin.from("notifications").insert({
      profile_id: a.id,
      type: "order_cancelled",
      title: "Order cancelled by customer",
      body: `"${result.address}" was cancelled within the free-cancellation window.`,
    });
  }

  await runDispatchTick(admin);

  return NextResponse.json({ ok: true });
}
