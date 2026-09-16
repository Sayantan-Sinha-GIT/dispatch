import { describe, expect, it } from 'vitest';

import { haversineDistanceKm } from './haversine';
import { computeRouteDistanceKm, optimizeRoutes } from './optimizer';
import type { OptimizationResult, RoutingOrder, RoutingRider } from './types';

/** Floating-point slack, in km. */
const TOL = 1e-9;

/**
 * Deterministic PRNG (mulberry32) so any failing fixture is reproducible.
 * Deliberately not Math.random().
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orders scattered around central Bengaluru; riders' depots scattered nearby. */
function makeFixture(seed: number, orderCount: number, riderCount: number) {
  const rng = makeRng(seed);
  const baseLat = 12.9716;
  const baseLng = 77.5946;

  const orders: RoutingOrder[] = Array.from({ length: orderCount }, (_, i) => ({
    id: `o${String(i).padStart(3, '0')}`,
    lat: baseLat + (rng() - 0.5) * 0.2,
    lng: baseLng + (rng() - 0.5) * 0.2,
    weight: 1 + rng() * 4,
  }));

  const perRider = Math.ceil(orderCount / Math.max(1, riderCount));
  const riders: RoutingRider[] = Array.from({ length: riderCount }, (_, i) => ({
    id: `r${String(i).padStart(2, '0')}`,
    capacity: perRider + 2,
    depotLat: baseLat + (rng() - 0.5) * 0.1,
    depotLng: baseLng + (rng() - 0.5) * 0.1,
  }));

  return { orders, riders };
}

function assignedIds(result: OptimizationResult): string[] {
  return result.routes.flatMap((route) => route.stops.map((stop) => stop.orderId));
}

const FIXTURES = [
  { name: '5 orders / 2 riders', seed: 1, orderCount: 5, riderCount: 2 },
  { name: '20 orders / 3 riders', seed: 2, orderCount: 20, riderCount: 3 },
  { name: '50 orders / 4 riders', seed: 3, orderCount: 50, riderCount: 4 },
];

describe('haversineDistanceKm', () => {
  it('is zero for identical points', () => {
    expect(haversineDistanceKm({ lat: 12.9, lng: 77.6 }, { lat: 12.9, lng: 77.6 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { lat: 12.9716, lng: 77.5946 };
    const b = { lat: 13.0827, lng: 80.2707 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 12);
  });

  it('matches a known distance (Bengaluru -> Chennai, ~290 km)', () => {
    const d = haversineDistanceKm({ lat: 12.9716, lng: 77.5946 }, { lat: 13.0827, lng: 80.2707 });
    expect(d).toBeGreaterThan(280);
    expect(d).toBeLessThan(300);
  });

  it('one degree of latitude is ~111.19 km', () => {
    expect(haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe('acceptance 1: capacity is never exceeded', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}`, () => {
      const { orders, riders } = makeFixture(
        fixture.seed,
        fixture.orderCount,
        fixture.riderCount,
      );
      const result = optimizeRoutes(orders, riders);

      for (const route of result.routes) {
        const rider = riders.find((r) => r.id === route.riderId)!;
        expect(route.stops.length).toBeLessThanOrEqual(rider.capacity);
      }
    });
  }

  it('holds when capacity is tight (exactly enough)', () => {
    const { orders } = makeFixture(11, 12, 1);
    const riders: RoutingRider[] = [
      { id: 'r0', capacity: 4, depotLat: 12.97, depotLng: 77.59 },
      { id: 'r1', capacity: 4, depotLat: 12.99, depotLng: 77.61 },
      { id: 'r2', capacity: 4, depotLat: 12.95, depotLng: 77.57 },
    ];
    const result = optimizeRoutes(orders, riders);

    for (const route of result.routes) {
      expect(route.stops.length).toBeLessThanOrEqual(4);
    }
    expect(result.unassignedOrderIds).toEqual([]);
    expect(assignedIds(result)).toHaveLength(12);
  });
});

describe('acceptance 2: every order is assigned exactly once', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}`, () => {
      const { orders, riders } = makeFixture(
        fixture.seed,
        fixture.orderCount,
        fixture.riderCount,
      );
      const result = optimizeRoutes(orders, riders);

      const ids = assignedIds(result);
      expect(result.unassignedOrderIds).toEqual([]);
      expect(new Set(ids).size).toBe(ids.length); // no duplicates
      expect([...ids].sort()).toEqual(orders.map((o) => o.id).sort());
    });
  }

  it('stop sequences are contiguous 0..n-1 within each route', () => {
    const { orders, riders } = makeFixture(4, 25, 3);
    const result = optimizeRoutes(orders, riders);

    for (const route of result.routes) {
      expect(route.stops.map((s) => s.sequence)).toEqual(
        route.stops.map((_, index) => index),
      );
    }
  });

  it('overflow orders land in unassignedOrderIds when capacity is insufficient', () => {
    const { orders } = makeFixture(5, 10, 1);
    const riders: RoutingRider[] = [
      { id: 'r0', capacity: 3, depotLat: 12.97, depotLng: 77.59 },
      { id: 'r1', capacity: 3, depotLat: 13.0, depotLng: 77.62 },
    ];
    const result = optimizeRoutes(orders, riders);

    const ids = assignedIds(result);
    expect(ids).toHaveLength(6);
    expect(result.unassignedOrderIds).toHaveLength(4);
    expect(new Set([...ids, ...result.unassignedOrderIds]).size).toBe(10);
    expect([...ids, ...result.unassignedOrderIds].sort()).toEqual(
      orders.map((o) => o.id).sort(),
    );
    for (const route of result.routes) {
      expect(route.stops.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('acceptance 3: optimized distance is never worse than the naive baseline', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}`, () => {
      const { orders, riders } = makeFixture(
        fixture.seed,
        fixture.orderCount,
        fixture.riderCount,
      );
      const result = optimizeRoutes(orders, riders);

      expect(result.naiveBaselineDistanceKm).toBeGreaterThan(0);
      expect(result.totalDistanceKm).toBeLessThanOrEqual(result.naiveBaselineDistanceKm + TOL);
    });
  }

  it('holds across many seeds', () => {
    for (let seed = 100; seed < 140; seed += 1) {
      const orderCount = 3 + (seed % 18);
      const riderCount = 1 + (seed % 4);
      const { orders, riders } = makeFixture(seed, orderCount, riderCount);
      const result = optimizeRoutes(orders, riders);
      expect(
        result.totalDistanceKm,
        `seed ${seed} (${orderCount} orders / ${riderCount} riders)`,
      ).toBeLessThanOrEqual(result.naiveBaselineDistanceKm + TOL);
    }
  });

  it('reported per-route distances sum to totalDistanceKm and match a fresh computation', () => {
    const { orders, riders } = makeFixture(7, 30, 3);
    const result = optimizeRoutes(orders, riders);

    const sum = result.routes.reduce((acc, route) => acc + route.distanceKm, 0);
    expect(sum).toBeCloseTo(result.totalDistanceKm, 9);

    for (const route of result.routes) {
      const rider = riders.find((r) => r.id === route.riderId)!;
      const recomputed = computeRouteDistanceKm(
        { lat: rider.depotLat, lng: rider.depotLng },
        orders,
        route.stops,
      );
      expect(recomputed).toBeCloseTo(route.distanceKm, 9);
    }
  });

  it('beats the baseline outright on a deliberately adversarial layout', () => {
    // Two tight clusters, one per depot, listed in pairs so that dealing them
    // round-robin to two riders splits each cluster across both depots, while the
    // nearest-depot assignment keeps each cluster with its own rider.
    const orders: RoutingOrder[] = [];
    for (let i = 0; i < 6; i += 2) {
      orders.push({ id: `a${i}`, lat: 12.9 + i * 0.001, lng: 77.5 + i * 0.001, weight: 1 });
      orders.push({ id: `a${i + 1}`, lat: 12.9 + (i + 1) * 0.001, lng: 77.5 + (i + 1) * 0.001, weight: 1 });
      orders.push({ id: `b${i}`, lat: 13.3 + i * 0.001, lng: 77.9 + i * 0.001, weight: 1 });
      orders.push({ id: `b${i + 1}`, lat: 13.3 + (i + 1) * 0.001, lng: 77.9 + (i + 1) * 0.001, weight: 1 });
    }
    const riders: RoutingRider[] = [
      { id: 'rA', capacity: 6, depotLat: 12.9, depotLng: 77.5 },
      { id: 'rB', capacity: 6, depotLat: 13.3, depotLng: 77.9 },
    ];

    const result = optimizeRoutes(orders, riders);
    expect(result.totalDistanceKm).toBeLessThan(result.naiveBaselineDistanceKm);
  });
});

describe('acceptance 4: determinism', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name} — identical result on a re-run`, () => {
      const { orders, riders } = makeFixture(
        fixture.seed,
        fixture.orderCount,
        fixture.riderCount,
      );
      const first = optimizeRoutes(orders, riders);
      const second = optimizeRoutes(orders, riders);

      expect(second).toEqual(first);
    });
  }

  it('is independent of the input ordering of the orders array', () => {
    const { orders, riders } = makeFixture(9, 18, 3);
    const shuffled = [...orders].reverse();

    const a = optimizeRoutes(orders, riders);
    const b = optimizeRoutes(shuffled, riders);

    // Assignments and sequences must not depend on how the caller ordered the rows.
    expect(
      b.routes.map((r) => ({ riderId: r.riderId, stops: r.stops })),
    ).toEqual(a.routes.map((r) => ({ riderId: r.riderId, stops: r.stops })));
  });
});

describe('edge cases', () => {
  it('zero orders returns empty routes, not a throw', () => {
    const riders: RoutingRider[] = [
      { id: 'r0', capacity: 5, depotLat: 12.97, depotLng: 77.59 },
    ];
    const result = optimizeRoutes([], riders);

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].stops).toEqual([]);
    expect(result.routes[0].distanceKm).toBe(0);
    expect(result.unassignedOrderIds).toEqual([]);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.naiveBaselineDistanceKm).toBe(0);
  });

  it('zero riders leaves every order unassigned, not a throw', () => {
    const { orders } = makeFixture(6, 4, 1);
    const result = optimizeRoutes(orders, []);

    expect(result.routes).toEqual([]);
    expect([...result.unassignedOrderIds].sort()).toEqual(orders.map((o) => o.id).sort());
    expect(result.totalDistanceKm).toBe(0);
    expect(result.naiveBaselineDistanceKm).toBe(0);
  });

  it('zero orders and zero riders returns an empty result', () => {
    const result = optimizeRoutes([], []);
    expect(result).toEqual({
      routes: [],
      unassignedOrderIds: [],
      totalDistanceKm: 0,
      naiveBaselineDistanceKm: 0,
    });
  });

  it('one rider with exactly enough capacity takes every order', () => {
    const { orders } = makeFixture(8, 9, 1);
    const riders: RoutingRider[] = [
      { id: 'solo', capacity: 9, depotLat: 12.97, depotLng: 77.59 },
    ];
    const result = optimizeRoutes(orders, riders);

    expect(result.unassignedOrderIds).toEqual([]);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].stops).toHaveLength(9);
    expect([...assignedIds(result)].sort()).toEqual(orders.map((o) => o.id).sort());
    expect(result.totalDistanceKm).toBeLessThanOrEqual(result.naiveBaselineDistanceKm + TOL);
  });

  it('a single order produces a single depot -> stop leg', () => {
    const order: RoutingOrder = { id: 'only', lat: 13.0, lng: 77.7, weight: 2 };
    const rider: RoutingRider = { id: 'r0', capacity: 3, depotLat: 12.97, depotLng: 77.59 };
    const result = optimizeRoutes([order], [rider]);

    expect(result.routes[0].stops).toEqual([{ orderId: 'only', sequence: 0 }]);
    expect(result.totalDistanceKm).toBeCloseTo(
      haversineDistanceKm({ lat: rider.depotLat, lng: rider.depotLng }, order),
      9,
    );
  });

  it('a rider with zero capacity receives nothing', () => {
    const { orders } = makeFixture(12, 5, 1);
    const riders: RoutingRider[] = [
      { id: 'idle', capacity: 0, depotLat: 12.97, depotLng: 77.59 },
      { id: 'busy', capacity: 5, depotLat: 12.99, depotLng: 77.61 },
    ];
    const result = optimizeRoutes(orders, riders);

    expect(result.routes.find((r) => r.riderId === 'idle')!.stops).toEqual([]);
    expect(result.routes.find((r) => r.riderId === 'busy')!.stops).toHaveLength(5);
    expect(result.unassignedOrderIds).toEqual([]);
  });
});

describe('computeRouteDistanceKm', () => {
  it('sums the depot leg plus each hop, one-way (no return to depot)', () => {
    const depot = { lat: 12.9, lng: 77.5 };
    const orders: RoutingOrder[] = [
      { id: 'x', lat: 12.95, lng: 77.55, weight: 1 },
      { id: 'y', lat: 13.0, lng: 77.6, weight: 1 },
    ];
    const expected =
      haversineDistanceKm(depot, orders[0]) + haversineDistanceKm(orders[0], orders[1]);

    expect(
      computeRouteDistanceKm(depot, orders, [
        { orderId: 'x', sequence: 0 },
        { orderId: 'y', sequence: 1 },
      ]),
    ).toBeCloseTo(expected, 12);
  });

  it('respects the sequence field rather than array order', () => {
    const depot = { lat: 12.9, lng: 77.5 };
    const orders: RoutingOrder[] = [
      { id: 'x', lat: 12.95, lng: 77.55, weight: 1 },
      { id: 'y', lat: 13.0, lng: 77.6, weight: 1 },
    ];
    const inOrder = computeRouteDistanceKm(depot, orders, [
      { orderId: 'x', sequence: 0 },
      { orderId: 'y', sequence: 1 },
    ]);
    const shuffledInput = computeRouteDistanceKm(depot, orders, [
      { orderId: 'y', sequence: 1 },
      { orderId: 'x', sequence: 0 },
    ]);

    expect(shuffledInput).toBeCloseTo(inOrder, 12);
  });

  it('returns 0 for an empty route', () => {
    expect(computeRouteDistanceKm({ lat: 12.9, lng: 77.5 }, [], [])).toBe(0);
  });

  it('throws on an unknown order id', () => {
    expect(() =>
      computeRouteDistanceKm({ lat: 12.9, lng: 77.5 }, [], [{ orderId: 'ghost', sequence: 0 }]),
    ).toThrow(/ghost/);
  });
});
