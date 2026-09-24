"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { isSlow, resolveSaver, SAVER_MODE_COOKIE, SAVER_NET_COOKIE, type SaverMode } from "@/lib/dataSaver";

type NetInfo = { effectiveType?: string; downlink?: number; saveData?: boolean } & EventTarget;

type DataSaver = {
  /** Whether the light version is showing right now. */
  on: boolean;
  mode: SaverMode;
  /** Whether the connection currently looks slow. */
  slow: boolean;
  setMode: (m: SaverMode) => void;
};

const Ctx = createContext<DataSaver>({ on: false, mode: "auto", slow: false, setMode: () => {} });

export function useDataSaver() {
  return useContext(Ctx);
}

function connection(): NetInfo | undefined {
  return (navigator as Navigator & { connection?: NetInfo }).connection;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Holds Data Saver for the whole app. Starts from the server's decision, so
 * the first paint is already right, then keeps watching the connection:
 * Chrome (and the Android app's web view) report its quality and fire an
 * event when it changes. Also turns off heavy motion everywhere while on.
 */
export function DataSaverProvider({
  initialMode,
  initialSlow,
  children,
}: {
  initialMode: SaverMode;
  initialSlow: boolean;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<SaverMode>(initialMode);
  const [slow, setSlow] = useState(initialSlow);
  const on = resolveSaver(mode, slow);

  useEffect(() => {
    const c = connection();
    if (!c) return;
    const measure = () => {
      const s = isSlow({ ect: c.effectiveType, downlink: c.downlink, saveData: c.saveData });
      setSlow(s);
      // Remembered for the server, so the next page it sends is already light.
      writeCookie(SAVER_NET_COOKIE, s ? "slow" : "fast");
    };
    measure();
    c.addEventListener("change", measure);
    return () => c.removeEventListener("change", measure);
  }, []);

  useEffect(() => {
    if (on) document.documentElement.setAttribute("data-saver", "on");
    else document.documentElement.removeAttribute("data-saver");
  }, [on]);

  const setMode = useCallback((m: SaverMode) => {
    setModeState(m);
    writeCookie(SAVER_MODE_COOKIE, m);
  }, []);

  const value = useMemo(() => ({ on, mode, slow, setMode }), [on, mode, slow, setMode]);

  return (
    <Ctx.Provider value={value}>
      {/* "always" keeps fades but drops movement, springs and parallax. */}
      <MotionConfig reducedMotion={on ? "always" : "user"}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}
