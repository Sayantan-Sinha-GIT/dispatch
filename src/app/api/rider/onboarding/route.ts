import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const { capacity, depotLat, depotLng } = await request.json();
  if (depotLat == null || depotLng == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "rider") {
    return NextResponse.json({ error: "Not a rider account" }, { status: 403 });
  }

  const { data: existing } = await admin.from("riders").select("id").eq("profile_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  const { error } = await admin.from("riders").insert({
    profile_id: user.id,
    capacity: capacity ?? 10,
    depot_lat: depotLat,
    depot_lng: depotLng,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
