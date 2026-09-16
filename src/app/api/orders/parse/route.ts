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

  const { rawText } = await request.json();
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
