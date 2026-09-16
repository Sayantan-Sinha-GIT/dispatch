import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const { name, email, password, capacity, depotLat, depotLng } = await request.json();

  if (!name || !email || !password || depotLat == null || depotLng == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "rider" },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account" },
      { status: 400 },
    );
  }

  const { error: riderError } = await admin.from("riders").insert({
    profile_id: created.user.id,
    capacity: capacity ?? 10,
    depot_lat: depotLat,
    depot_lng: depotLng,
  });

  if (riderError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: riderError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
