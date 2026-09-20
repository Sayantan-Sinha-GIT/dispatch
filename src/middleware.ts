import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // API routes handle their own auth/authorization server-side (they need
  // to be reachable while signed out, e.g. rider signup) — don't gate them here.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path === "/rider/signup" ||
    path.startsWith("/auth/callback") ||
    // Reachable signed out on purpose: an expired or already-spent recovery
    // link leaves no session, and the page's own "ask for a new link" message
    // is the useful answer. Gating it here would bounce those people to a
    // sign-in form that cannot explain what went wrong.
    path === "/reset-password";
  const isPublic = isAuthRoute || path === "/";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("role", path.startsWith("/rider") ? "rider" : path.startsWith("/shop") ? "customer" : "admin");
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !isAuthRoute &&
    (path.startsWith("/admin") || path.startsWith("/rider") || path.startsWith("/shop"))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile?.role) {
      // Role not finalized yet (e.g. a magic-link click that bypassed /auth/callback) — sign
      // out rather than guessing a portal, which would otherwise redirect-loop right back here.
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    const home = profile.role === "admin" ? "/admin" : profile.role === "customer" ? "/shop" : "/rider";

    const wantsArea = path.startsWith("/admin") ? "admin" : path.startsWith("/shop") ? "customer" : "rider";
    if (profile.role !== wantsArea) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }

    if (profile?.role === "rider" && path !== "/rider/onboarding") {
      const { data: rider } = await supabase.from("riders").select("id").eq("profile_id", user.id).maybeSingle();
      if (!rider) {
        const url = request.nextUrl.clone();
        url.pathname = "/rider/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|ico|webmanifest)$).*)",
  ],
};
