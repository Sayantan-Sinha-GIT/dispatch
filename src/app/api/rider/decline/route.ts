import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reassignOrExpire, runDispatchTick } from "@/lib/dispatch";

/**
 * Explicit decline. Unlike letting the offer time out, this carries no penalty
 * streak — it's counted separately so admins can still spot cherry-picking —
 * and the order is handed straight to the next rider instead of sitting for the
 * rest of the 5-minute window.
 */
export async function POST(request: NextRequest) {
  const { orderId } = (await request.json()) as { orderId?: string };
  if (!orderId) {
    return NextResponse.json({ code: "missing_order", error: "Missing order" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase.rpc("decline_offer", { p_order_id: orderId });
  if (error) {
    console.error("decline_offer failed", error);
    return NextResponse.json({ code: "decline_failed", error: "Could not decline." }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; rider_id?: string };
  if (!result?.ok) {
    return NextResponse.json(
      {
        code: result?.error ?? "decline_failed",
        error:
          result?.error === "offer_no_longer_available"
            ? "That offer has already moved on."
            : "Could not decline.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (order) {
    await reassignOrExpire(admin, order, { penalize: false, excludeRiderId: result.rider_id });
  }
  await runDispatchTick(admin);

  return NextResponse.json({ ok: true });
}
