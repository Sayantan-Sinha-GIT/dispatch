import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDispatchTick } from "@/lib/dispatch";

// Polled periodically by every open dashboard, since this app has no standing
// background worker. One tick retires offers past their 5-minute window and
// re-plans the pending pool through the routing engine. Any signed-in user may
// trigger it — it only ever acts on already-due work, never on their behalf.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const result = await runDispatchTick(admin);

  return NextResponse.json({ processed: result.expired, ...result });
}
