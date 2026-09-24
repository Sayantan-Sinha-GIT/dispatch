import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullOrderFromRider } from "@/lib/dispatch";

// Admin manual override for an order stuck with a rider who went dark
// mid-delivery (offline without completing it, or simply unresponsive). The
// order goes to the nearest other rider with room, or back to the pool.
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

  const res = await pullOrderFromRider(admin, id);
  if (!res.ok) {
    return NextResponse.json({ code: res.code, error: res.error }, { status: res.code === "not_found" ? 404 : 409 });
  }
  return NextResponse.json({ ok: true });
}
