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

type Listener = Promise<{ remove(): Promise<void> }>;

type PushPlugin = {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  createChannel(c: { id: string; name: string; description?: string; importance: number; visibility?: number; vibration?: boolean }): Promise<void>;
  addListener(event: "registration", cb: (t: { value: string }) => void): Listener;
  addListener(event: "registrationError", cb: (e: { error: string }) => void): Listener;
  addListener(event: "pushNotificationActionPerformed", cb: (a: { notification: { data?: Record<string, string> } }) => void): Listener;
};

type BgLocation = { latitude: number; longitude: number; accuracy: number; time: number | null };

type BackgroundGeolocationPlugin = {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (location?: BgLocation, error?: { code?: string; message?: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    /** @capacitor-community/background-geolocation, from app 2.3.0. */
    BackgroundGeolocation?: BackgroundGeolocationPlugin;
    SocialLogin?: SocialLoginPlugin;
    App?: AppPlugin;
    /** @capacitor/push-notifications, from app 2.2.0. */
    PushNotifications?: PushPlugin;
    /** The app's own plugin (android-app/.../SystemBarsPlugin.java), from 2.0.2. */
    DispatchBars?: { set(options: { color: string; dark: boolean }): Promise<void> };
  };
};

/** Recolours the phone's status and navigation bar strips to match the page. */
export function setNativeBars(theme: "dark" | "light") {
  if (!isNativeApp()) return;
  capacitor()
    ?.Plugins?.DispatchBars?.set({ color: theme === "dark" ? "#0d0b14" : "#f2f0f8", dark: theme === "dark" })
    .catch(() => {});
}

/**
 * Keeps a rider's position flowing while they are online, even with the
 * screen off or another app in front: Android runs it as a location
 * foreground service, which is why it shows an ongoing notification (Android
 * requires one, and it also tells the rider plainly that they are being
 * tracked). Returns a stop function, or null when this app build has no
 * background tracker - the caller then falls back to the browser's own
 * location watch, which only works while the app is open.
 */
export async function startBackgroundLocation(
  texts: { title: string; message: string },
  onFix: (lat: number, lng: number) => void,
  onDenied: () => void,
): Promise<(() => void) | null> {
  const bg = isNativeApp() ? capacitor()?.Plugins?.BackgroundGeolocation : undefined;
  if (!bg) return null;
  const id = await bg.addWatcher(
    // 25 m between fixes: enough to follow a scooter street by street without
    // waking the radio for every step.
    { backgroundTitle: texts.title, backgroundMessage: texts.message, requestPermissions: true, stale: false, distanceFilter: 25 },
    (location, error) => {
      if (error) {
        if (error.code === "NOT_AUTHORIZED") onDenied();
        return;
      }
      if (location) onFix(location.latitude, location.longitude);
    },
  );
  return () => {
    bg.removeWatcher({ id }).catch(() => {});
  };
}

/** Opens Android's settings for this app, e.g. to turn location back on. */
export function openNativeAppSettings() {
  capacitor()?.Plugins?.BackgroundGeolocation?.openSettings().catch(() => {});
}

const PUSH_TOKEN_KEY = "push-token";

/**
 * Turns on push notifications for the signed-in person on this phone: asks
 * permission once (Android 13+), sets up the two channels, and hands the
 * phone's token to the server. `onOpen` receives the screen to show when a
 * notification is tapped. Returns a cleanup for the listeners.
 */
export async function enableNativePush(onOpen: (url: string) => void): Promise<() => void> {
  const push = isNativeApp() ? capacitor()?.Plugins?.PushNotifications : undefined;
  if (!push) return () => {};
  const handles: Awaited<Listener>[] = [];
  handles.push(
    await push.addListener("registration", ({ value }) => {
      try {
        localStorage.setItem(PUSH_TOKEN_KEY, value);
      } catch {
        // only needed to unregister on sign-out
      }
      fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      }).catch(() => {});
    }),
    await push.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = notification.data?.url;
      if (url && url.startsWith("/")) onOpen(url);
    }),
  );
  let perm = await push.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await push.requestPermissions();
  if (perm.receive === "granted") {
    // Offers ring and pop up over whatever the rider is doing; the rest are ordinary.
    await push.createChannel({ id: "offers", name: "Delivery offers", description: "New deliveries you can accept", importance: 5, visibility: 1, vibration: true });
    await push.createChannel({ id: "updates", name: "Order updates", description: "Your orders, support replies and account news", importance: 3, visibility: 1 });
    await push.register();
  }
  return () => handles.forEach((h) => h.remove());
}

/** Stops notifications for the account signing out on this phone. */
export async function disableNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  let token: string | null = null;
  try {
    token = localStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return;
  }
  if (!token) return;
  await fetch("/api/push/register", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}

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
