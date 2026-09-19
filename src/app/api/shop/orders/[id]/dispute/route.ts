import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ERROR_CODES: Record<string, string> = {
  not_found: "We couldn't find that order.",
  not_delivered_yet: "That order isn't marked delivered.",
  already_disputed: "You've already reported this order.",
};

/**
 * "I never received this." The counterweight to a rider being able to mark an
 * order delivered: the claim is recorded on the order, raised as a support
 * ticket, and pushed to every admin, who can then put the order back on the
 * road from the command console.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason } = (await request.json()) as { reason?: string };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 3) {
    return NextResponse.json({ code: "missing_fields", error: "Tell us what happened." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("report_order_not_delivered", {
    p_order_id: id,
    p_reason: trimmed,
  });
  if (error) {
    console.error("report_order_not_delivered failed", error);
    return NextResponse.json({ code: "dispute_failed", error: "Could not file that report." }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; address?: string; rider_id?: string | null };
  if (!result?.ok) {
    const code = result?.error ?? "dispute_failed";
    return NextResponse.json(
      { code, error: ERROR_CODES[code] ?? "Could not file that report." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error: ticketError } = await admin.from("support_tickets").insert({
    customer_id: user.id,
    order_id: id,
    subject: "Order marked delivered but not received",
    message: trimmed,
  });
  if (ticketError) console.error("dispute ticket insert failed", ticketError);

  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) {
    const { error: notifyError } = await admin.from("notifications").insert({
      profile_id: a.id,
      type: "order_disputed",
      title: "Non-delivery reported",
      body: `A customer says "${result.address}" was marked delivered but never arrived.`,
      related_order_id: id,
    });
    if (notifyError) console.error("dispute notification failed", notifyError);
  }

  return NextResponse.json({ ok: true });
}
