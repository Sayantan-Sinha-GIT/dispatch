import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDispatchTick } from "@/lib/dispatch";

/**
 * Manual "re-optimize now" override. Dispatch already runs automatically on
 * checkout, on a rider coming online, and on every dashboard tick — this is the
 * admin's way to force a pass immediately and get the before/after numbers
 * logged as an optimization run.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ code: "admin_only", error: "Admin only" }, { status: 403 });
  }

  const admin = createAdminClient();
  const result = await runDispatchTick(admin);

  if (result.considered === 0) {
    return NextResponse.json(
      { code: "no_pending_orders", error: "No pending orders to assign" },
      { status: 400 },
    );
  }
  if (result.noRiders) {
    return NextResponse.json(
      { code: "no_active_riders", error: "No active riders available" },
      { status: 400 },
    );
  }

  if (result.assigned > 0) {
    const { error: runError } = await admin.from("optimization_runs").insert({
      run_by: user.id,
      total_distance_before: result.baselineDistanceKm,
      total_distance_after: result.totalDistanceKm,
      algorithm_used: "nearest_neighbor_2opt",
    });
    if (runError) console.error("Failed to log optimization run", runError);
  }

  return NextResponse.json({ result });
}
