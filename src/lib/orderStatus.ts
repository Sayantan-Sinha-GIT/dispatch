/**
 * The one definition of "still in flight".
 *
 * Counters used to be written out by hand in each panel, which is how a list
 * could report active orders after one had been delivered and the other
 * cancelled. Both of those are terminal; so is `failed`. Everything else is
 * work the system still owes someone.
 */
export const ACTIVE_ORDER_STATUSES = ["pending", "offered", "assigned", "expired"] as const;

export const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled", "failed"] as const;

export function isActiveOrder(status: string) {
  return (ACTIVE_ORDER_STATUSES as readonly string[]).includes(status);
}

export function isTerminalOrder(status: string) {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}
