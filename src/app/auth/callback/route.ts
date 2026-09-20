import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { finalizeRole, type AuthIntent } from "@/lib/authFinalize";

/**
 * Lands both OAuth returns and the confirmation link from a signup email.
 *
 * Two link shapes reach us and we accept either:
 *  - `?code=` — the PKCE exchange, used by OAuth and by email links when the
 *    project is on the PKCE flow. It needs the code verifier the *same browser*
 *    stored at sign-up time.
 *  - `?token_hash=&type=` — the plain verification link, which works in any
 *    browser. Preferred when present precisely because it has no such
 *    dependency.
 *
 * A failure here is usually a link that was already spent (some mail clients
 * pre-fetch links, which consumes the token but still confirms the address), so
 * we send people to the sign-in form with a message that says exactly that
 * rather than a raw provider error.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  const intent = (searchParams.get("intent") ?? "customer") as AuthIntent;
  const role = intent === "rider" ? "rider" : "customer";
  // A password-recovery link carries the user to a form instead of into the
  // app. Treat it as recovery if Supabase says so, or if the link asked for it.
  const isRecovery = otpType === "recovery" || searchParams.get("next") === "/reset-password";
  // Never redirect anywhere but back into this app. A bare "/" prefix is not
  // enough — "//evil.com" is protocol-relative and leaves the site.
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : "/reset-password";
  const deadLink = `${origin}/login?role=${role}&err=${isRecovery ? "resetLinkDead" : "linkExpired"}`;

  if (providerError) {
    return NextResponse.redirect(deadLink);
  }
  if (!code && !tokenHash) {
    return NextResponse.redirect(isRecovery ? deadLink : `${origin}/login?role=${role}&err=linkInvalid`);
  }

  const supabase = await createClient();

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType ?? "email" })
    : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    return NextResponse.redirect(deadLink);
  }

  // Recovery stops here on purpose. The session it opens exists only so the
  // user can set a new password; stamping roles or sending them into the app
  // would skip the very step the link was for.
  if (isRecovery) {
    return NextResponse.redirect(`${origin}${nextPath}?role=${role}`);
  }

  const result = await finalizeRole(supabase, intent);
  if ("error" in result) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?role=${role}&error=${encodeURIComponent(result.error)}`);
  }

  if (result.role === "rider") {
    return NextResponse.redirect(`${origin}${result.needsRiderOnboarding ? "/rider/onboarding" : "/rider"}`);
  }
  return NextResponse.redirect(`${origin}/shop`);
}
