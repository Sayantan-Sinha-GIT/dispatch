import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseOrdersFromText } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { rawText, editOrderId } = await request.json();
  if (!rawText || typeof rawText !== "string") {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  try {
    const parsedOrders = await parseOrdersFromText(rawText);
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    const sanitizeTime = (t: string | null) => (t && timePattern.test(t) ? t : null);

    const rows = parsedOrders.map((o) => ({
      raw_text: rawText,
      address: o.address,
      lat: o.lat,
      lng: o.lng,
      weight: o.weight ?? 1,
      time_window_start: sanitizeTime(o.time_window_start),
      time_window_end: sanitizeTime(o.time_window_end),
      status: "pending" as const,
    }));

    // Re-parsing a tagged order's text (e.g. after fixing a typo) must edit that
    // order in place, not insert a second copy of it alongside the original.
    if (editOrderId && rows.length > 0) {
      const [primary, ...rest] = rows;
      const { data: updated, error: updateError } = await supabase
        .from("orders")
        .update({
          ...primary,
          assigned_rider_id: null,
          sequence_in_route: null,
          offered_at: null,
          accepted_at: null,
        })
        .eq("id", editOrderId)
        .select();
      if (updateError) throw updateError;

      let inserted: typeof updated = [];
      if (rest.length > 0) {
        const { data, error } = await supabase.from("orders").insert(rest).select();
        if (error) throw error;
        inserted = data;
      }
      return NextResponse.json({ orders: [...(updated ?? []), ...inserted] });
    }

    const { data, error } = await supabase.from("orders").insert(rows).select();
    if (error) throw error;

    return NextResponse.json({ orders: data });
  } catch (err) {
    console.error("Order parse failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse orders" },
      { status: 500 },
    );
  }
}
