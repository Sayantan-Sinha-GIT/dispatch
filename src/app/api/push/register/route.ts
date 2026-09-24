import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function readToken(request: NextRequest): Promise<string | null> {
  try {
    const { token } = (await request.json()) as { token?: unknown };
    return typeof token === "string" && token.length > 20 && token.length < 4096 ? token : null;
  } catch {
    return null;
  }
}

/**
 * The Android app registers its push token for whoever is signed in. A token
 * belongs to one phone, so if someone else signs in on that phone the token
 * simply moves to them.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const token = await readToken(request);
  if (!token) return NextResponse.json({ error: "Bad token" }, { status: 400 });

  const { error } = await createAdminClient()
    .from("push_tokens")
    .upsert({ token, profile_id: user.id, platform: "android", updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Signing out stops this phone's notifications for that account. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true });
  const token = await readToken(request);
  if (!token) return NextResponse.json({ ok: true });
  await createAdminClient().from("push_tokens").delete().eq("token", token).eq("profile_id", user.id);
  return NextResponse.json({ ok: true });
}
