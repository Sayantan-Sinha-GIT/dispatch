import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeRole, type AuthIntent } from "@/lib/authFinalize";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const intent = (searchParams.get("intent") ?? "customer") as AuthIntent;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?role=${intent}&error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?role=${intent}&error=${encodeURIComponent(error.message)}`);
  }

  const result = await finalizeRole(supabase, intent);
  if ("error" in result) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?role=${intent}&error=${encodeURIComponent(result.error)}`);
  }

  if (result.role === "rider") {
    return NextResponse.redirect(`${origin}${result.needsRiderOnboarding ? "/rider/onboarding" : "/rider"}`);
  }
  return NextResponse.redirect(`${origin}/shop`);
}
