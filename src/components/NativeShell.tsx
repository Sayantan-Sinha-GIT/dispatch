"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { nativeAppPlugin, setNativeBars } from "@/lib/nativeApp";
import { useThemeName } from "@/lib/browserState";

/** Each portal's first screen, plus the two ways in. Back from here leaves the app. */
const ROOTS = new Set(["/", "/login", "/shop", "/rider", "/admin"]);

/**
 * The website's side of the Android app. Renders nothing, and does nothing
 * outside the app.
 *
 * The status and navigation bar strips follow the light/dark theme.
 *
 * The back button behaves as people expect it in an app. Walking browser
 * history alone is wrong here: opening the app signed in lands on "/" and is
 * redirected to the portal, so going back to "/" redirects forward again and
 * back never leaves. Instead, a portal's main screen exits the app, and any
 * deeper page steps back — or up to its portal when it was opened directly
 * from a link and has nothing behind it.
 */
export function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const theme = useThemeName();

  useEffect(() => {
    setNativeBars(theme);
  }, [theme]);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const app = nativeAppPlugin();
    if (!app) return;
    const handle = app.addListener("backButton", ({ canGoBack }) => {
      const path = pathRef.current;
      if (ROOTS.has(path)) {
        app.exitApp();
      } else if (canGoBack) {
        window.history.back();
      } else {
        const portal = `/${path.split("/")[1]}`;
        router.replace(ROOTS.has(portal) ? portal : "/");
      }
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [router]);

  return null;
}
