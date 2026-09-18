import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type AuthIntent = "customer" | "rider";

/**
 * OAuth and email-OTP sign-ins carry no `role` in user_metadata (unlike password
 * signup, which sets it explicitly), so `handle_new_user` leaves profiles.role
 * null for them. This assigns the role the user actually signed in for, once,
 * right after their session is established — and never overwrites an existing
 * role (so a rider can't accidentally relabel themselves a customer by hitting
 * the wrong login link).
 */
export async function finalizeRole(
  userClient: SupabaseClient<Database>,
  intent: AuthIntent,
): Promise<{ role: string; needsRiderOnboarding: boolean } | { error: string }> {
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { error: "Not signed in" };

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
    return { error: `This account is registered as ${role}, not ${intent}.` };
  }

  let needsRiderOnboarding = false;
  if (role === "rider") {
    const { data: rider } = await admin
      .from("riders")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    needsRiderOnboarding = !rider;
  }

  return { role, needsRiderOnboarding };
}
