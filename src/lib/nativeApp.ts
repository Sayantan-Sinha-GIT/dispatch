/**
 * The Android app is this same site inside a Capacitor shell. The shell
 * injects `window.Capacitor` with its native plugins, so the site can ask the
 * phone to do what a browser can't, without shipping any of that code to
 * ordinary visitors.
 */

type SocialLoginPlugin = {
  initialize(options: { google: { webClientId: string } }): Promise<void>;
  login(options: { provider: "google"; options: Record<string, never> }): Promise<{
    result?: { idToken?: string | null };
  }>;
};

type AppPlugin = {
  addListener(event: "backButton", cb: (e: { canGoBack: boolean }) => void): Promise<{ remove(): Promise<void> }>;
  exitApp(): Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: { SocialLogin?: SocialLoginPlugin; App?: AppPlugin };
};

/** The app's native App plugin (back button, exit), or undefined in a browser. */
export function nativeAppPlugin(): AppPlugin | undefined {
  return isNativeApp() ? capacitor()?.Plugins?.App : undefined;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the Android app, false in any browser. */
export function isNativeApp(): boolean {
  return !!capacitor()?.isNativePlatform?.();
}

/**
 * The *Web* OAuth client that Supabase's Google provider is configured with.
 * Google's sign-in sheet on the phone issues its ID token for this audience,
 * which is what lets Supabase accept it. (The Android OAuth client in the same
 * Google Cloud project only authorises the app's package and signing key; it
 * is never passed here.) A client ID is public by design.
 */
const GOOGLE_WEB_CLIENT_ID = "645943716722-uv2b2k6im5f24c5c3brm16kbb5r4lf5i.apps.googleusercontent.com";

let initialized: Promise<void> | null = null;

/**
 * Opens the phone's own "Choose an account" sheet and returns a Google ID
 * token, or null if the person closed it. Throws if the app cannot sign in
 * with Google at all.
 */
export async function nativeGoogleIdToken(): Promise<string | null> {
  const plugin = capacitor()?.Plugins?.SocialLogin;
  if (!plugin) throw new Error("Google sign-in is not available in this version of the app.");
  initialized ??= plugin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
  await initialized;
  try {
    // No `scopes`: the ID token already carries the email and name, and
    // asking for scopes switches the plugin to an authorisation flow that
    // needs extra native wiring.
    const res = await plugin.login({ provider: "google", options: {} });
    return res.result?.idToken ?? null;
  } catch (e) {
    // Dismissing the sheet is a choice, not an error worth a red message.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return null;
    throw e;
  }
}
