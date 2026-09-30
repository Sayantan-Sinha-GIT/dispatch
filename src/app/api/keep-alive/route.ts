import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called once a day by Vercel Cron (vercel.json). Supabase pauses free projects after about a
// week without database activity, which would take the whole app down with it.
export const dynamic = "force-dynamic";

export async function GET() {
  const { count, error } = await createAdminClient()
    .from("products")
    .select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, products: count });
}
