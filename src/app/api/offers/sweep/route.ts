import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sweepExpiredOffers } from "@/lib/dispatch";

// Polled periodically by both dashboards while open, since this app has no
// standing background worker. Any signed-in user may trigger a sweep — it
// only ever acts on orders that are already past their 5-minute window.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const processed = await sweepExpiredOffers(admin);

  return NextResponse.json({ processed });
}
