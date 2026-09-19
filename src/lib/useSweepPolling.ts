import { useEffect } from "react";

/**
 * Polls the offer-expiry sweep while a dashboard is open (no standing
 * background worker exists).
 *
 * `onTick` is a reconciliation hook. Realtime alone is not enough for a rider:
 * when an order is cancelled or pulled away, the row stops matching their RLS
 * policy in the same statement that changes it, so the UPDATE event is filtered
 * out and they never hear about it — their screen keeps showing work that is no
 * longer theirs. Re-reading on each tick closes that gap.
 */
export function useSweepPolling(intervalMs = 20000, onTick?: () => void) {
  useEffect(() => {
    const tick = () => {
      fetch("/api/offers/sweep", { method: "POST" })
        .catch((err) => {
          console.error("Offer sweep request failed", err);
        })
        .finally(() => onTick?.());
    };
    tick();
    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
