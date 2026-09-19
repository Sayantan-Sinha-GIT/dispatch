import { describe, expect, it } from "vitest";
import { quotePayout, PAYOUT_BASE, PAYOUT_PER_KG, PAYOUT_PER_KM } from "./pricing";
import { MAX_OFFER_DISTANCE_KM, isWithinServiceRange } from "./serviceArea";

/**
 * These guard a bug that shipped: a Bengaluru rider was offered a Kolkata order,
 * 1550 km away, and the payout came out at ₹9361 on a ₹190 basket. The distance
 * cap and the payout clamp are two independent defences against that, so both
 * are tested independently.
 */
describe("rider payout", () => {
  it("prices a normal hyperlocal job sensibly", () => {
    const quote = quotePayout(2, 4);
    expect(quote.total).toBe(PAYOUT_BASE + 2 * PAYOUT_PER_KG + 4 * PAYOUT_PER_KM);
    expect(quote.total).toBeLessThan(200);
  });

  it("never pays a cross-country distance, even if one is passed in", () => {
    const absurd = quotePayout(2, 1550.3);
    const capped = quotePayout(2, MAX_OFFER_DISTANCE_KM);
    expect(absurd.total).toBe(capped.total);
    expect(absurd.total).toBeLessThan(500);
  });

  it("reports the clamped distance, not the raw one", () => {
    expect(quotePayout(1, 1550.3).distanceKm).toBe(MAX_OFFER_DISTANCE_KM);
  });

  it("treats missing or nonsense inputs as zero rather than NaN", () => {
    expect(quotePayout(Number.NaN, Number.NaN).total).toBe(PAYOUT_BASE);
    expect(quotePayout(-5, -5).total).toBe(PAYOUT_BASE);
  });
});

describe("service radius", () => {
  it("accepts a drop inside the radius and rejects one beyond it", () => {
    expect(isWithinServiceRange(0)).toBe(true);
    expect(isWithinServiceRange(MAX_OFFER_DISTANCE_KM)).toBe(true);
    expect(isWithinServiceRange(MAX_OFFER_DISTANCE_KM + 0.1)).toBe(false);
    expect(isWithinServiceRange(1550.3)).toBe(false);
  });

  it("rejects a distance that could not be computed", () => {
    expect(isWithinServiceRange(Number.NaN)).toBe(false);
    expect(isWithinServiceRange(Infinity)).toBe(false);
  });
});
