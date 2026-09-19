/**
 * How far a rider may be from a drop before we simply don't offer it to them.
 *
 * Without this the router happily planned a Bengaluru rider onto a Kolkata
 * order — 1550 km, a payout of ₹9361 on a ₹190 basket, and a delivery nobody
 * could actually make. A hyperlocal service has a radius; this is it.
 *
 * An order with no rider inside the radius stays `pending` and silently waits.
 * Nobody is notified, because there is nothing anyone can usefully do about it.
 */
export const MAX_OFFER_DISTANCE_KM = 20;

export function isWithinServiceRange(distanceKm: number) {
  return Number.isFinite(distanceKm) && distanceKm <= MAX_OFFER_DISTANCE_KM;
}
