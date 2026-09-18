import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reassignRiderPendingOffers, runDispatchTick } from "@/lib/dispatch";

// Called right after a rider flips to "inactive" so any delivery they
// haven't accepted yet gets handed off immediately instead of waiting out
// the full 5-minute window. Going offline is a deliberate choice, not a
// miss, so this never touches the rider's penalty streak.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rider } = await supabase.from("riders").select("id").eq("profile_id", user.id).single();
  if (!rider) return NextResponse.json({ error: "Not a rider" }, { status: 403 });

  const admin = createAdminClient();
  const processed = await reassignRiderPendingOffers(admin, rider.id);
  await runDispatchTick(admin);

  return NextResponse.json({ processed });
}
