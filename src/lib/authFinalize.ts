import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type AuthIntent = "customer" | "rider";

/**
 * OAuth sign-ins carry no `role` in user_metadata (unlike password signup,
 * which sets it explicitly), so `handle_new_user` leaves profiles.role
 * null for them. This assigns the role the user actually signed in for, once,
 * right after their session is established — and never overwrites an existing
 * role (so a rider can't accidentally relabel themselves a customer by hitting
 * the wrong login link).
 */
export async function finalizeRole(
  userClient: SupabaseClient<Database>,
  intent: AuthIntent,
): Promise<
  | { role: string; needsRiderOnboarding: boolean }
  | { error: string; actualRole?: string }
> {
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { error: "notSignedIn" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  let role = profile?.role ?? null;

  if (!role) {
    role = intent;
    await admin
      .from("profiles")
      .update({
        role,
        name: profile ? undefined : (user.user_metadata?.name as string | undefined) ?? user.email ?? "User",
      })
      .eq("id", user.id);
  }

  if (role !== intent) {
    // A code, not a sentence. The caller turns this into a translated message
    // and can offer to switch to `actualRole` instead of leaving the user on a
    // tab that will never let them in.
    return { error: "wrongRole", actualRole: role };
  }

  let needsRiderOnboarding = false;
  if (role === "rider") {
    const { data: rider } = await admin
      .from("riders")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    // A rider who signed up through the form carries their depot and capacity
    // in user_metadata: the riders row can only be created now, because the
    // account did not exist as a confirmed user until this moment.
    const meta = user.user_metadata ?? {};
    const depotLat = Number(meta.depot_lat);
    const depotLng = Number(meta.depot_lng);
    if (!rider && Number.isFinite(depotLat) && Number.isFinite(depotLng)) {
      const capacity = Math.min(20, Math.max(1, Math.round(Number(meta.capacity) || 10)));
      const { error: riderError } = await admin.from("riders").insert({
        profile_id: user.id,
        capacity,
        depot_lat: depotLat,
        depot_lng: depotLng,
      });
      if (riderError) console.error("rider row creation failed", riderError);
      needsRiderOnboarding = !!riderError;
    } else {
      needsRiderOnboarding = !rider;
    }
  }

  return { role, needsRiderOnboarding };
}
