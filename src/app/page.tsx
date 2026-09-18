import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "admin") redirect("/admin");
    if (profile?.role === "customer") redirect("/shop");
    if (profile?.role === "rider") redirect("/rider");
    // Role not finalized yet (e.g. a magic-link click that bypassed /auth/callback) — sign out
    // rather than guessing a portal, which would otherwise redirect-loop against middleware.
    await supabase.auth.signOut();
    redirect("/login?error=Sign-in%20did%20not%20complete%20—%20please%20try%20again");
  }

  return <LandingPage />;
}
