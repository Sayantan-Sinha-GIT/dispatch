import { useEffect } from "react";

/** Polls the offer-expiry sweep while a dashboard is open (no standing background worker exists). */
export function useSweepPolling(intervalMs = 20000) {
  useEffect(() => {
    const tick = () => {
      fetch("/api/offers/sweep", { method: "POST" }).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}
