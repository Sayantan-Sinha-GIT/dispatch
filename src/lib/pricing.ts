/**
 * Rider payout model. Quoted to the rider in the offer popup and persisted on
 * the order at claim time, so the number they accepted is the number they're
 * credited on delivery — never recomputed later against different inputs.
 */
import { MAX_OFFER_DISTANCE_KM } from "@/lib/serviceArea";

export const PAYOUT_BASE = 35;
export const PAYOUT_PER_KG = 12;
export const PAYOUT_PER_KM = 6;

export interface PayoutQuote {
  base: number;
  weightComponent: number;
  distanceComponent: number;
  total: number;
  distanceKm: number;
}

export function quotePayout(weightKg: number, distanceKm: number): PayoutQuote {
  const safeWeight = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 0;
  // Clamped to the service radius as a backstop. Dispatch already refuses to
  // offer anything farther, but a payout is money: if a bad distance ever
  // reaches this function again it must not be able to mint ₹9361 for a ₹190
  // basket the way an unclamped 1550 km once did.
  const rawDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  const safeDistance = Math.min(rawDistance, MAX_OFFER_DISTANCE_KM);

  const weightComponent = Math.round(safeWeight * PAYOUT_PER_KG);
  const distanceComponent = Math.round(safeDistance * PAYOUT_PER_KM);

  return {
    base: PAYOUT_BASE,
    weightComponent,
    distanceComponent,
    total: PAYOUT_BASE + weightComponent + distanceComponent,
    distanceKm: Math.round(safeDistance * 10) / 10,
  };
}
