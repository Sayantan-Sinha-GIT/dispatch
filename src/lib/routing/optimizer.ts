import { haversineDistanceKm, type GeoPoint } from './haversine';
import type {
  OptimizationResult,
  RiderRoute,
  RouteStop,
  RoutingOrder,
  RoutingRider,
} from './types';

/**
 * Business model: a one-way delivery run. A route is depot -> stop1 -> ... -> stopN
 * with NO return-to-depot leg — the rider ends their shift at the last drop.
 * Every distance figure in this module (optimized and baseline alike) uses that
 * same convention, so the before/after comparison is apples-to-apples.
 */

/** Distances below this (in km) are treated as noise, not as an improvement. */
const EPSILON_KM = 1e-9;

/** Safety valve so a pathological input can never spin the 2-opt loop forever. */
const MAX_TWO_OPT_PASSES = 1000;

function depotOf(rider: RoutingRider): GeoPoint {
  return { lat: rider.depotLat, lng: rider.depotLng };
}

/**
 * Length of the path depot -> orders[0] -> orders[1] -> ... (one-way, no return leg).
 */
function pathDistanceKm(depot: GeoPoint, sequence: RoutingOrder[]): number {
  if (sequence.length === 0) return 0;

  let total = haversineDistanceKm(depot, sequence[0]);
  for (let i = 1; i < sequence.length; i += 1) {
    total += haversineDistanceKm(sequence[i - 1], sequence[i]);
  }
  return total;
}

/**
 * Public helper shared by the optimizer and its tests: given a depot, the pool of
 * orders those stops refer to, and the stops themselves, compute the route length.
 * Stops are ordered by their `sequence` field, so the caller need not pre-sort.
 */
export function computeRouteDistanceKm(
  depot: GeoPoint,
  orders: RoutingOrder[],
  stops: RouteStop[],
): number {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);

  const sequence: RoutingOrder[] = [];
  for (const stop of ordered) {
    const order = byId.get(stop.orderId);
    if (!order) {
      throw new Error(`computeRouteDistanceKm: unknown orderId "${stop.orderId}"`);
    }
    sequence.push(order);
  }

  return pathDistanceKm(depot, sequence);
}

function toStops(sequence: RoutingOrder[]): RouteStop[] {
  return sequence.map((order, index) => ({ orderId: order.id, sequence: index }));
}

/**
 * Step 1 — assignment. Each order goes to the nearest rider depot that still has
 * spare capacity. Orders are processed sorted by id so the outcome is independent
 * of input ordering; ties on distance are broken by the rider's position in the
 * input array (stable, deterministic).
 */
function greedyAssign(
  orders: RoutingOrder[],
  riders: RoutingRider[],
): { assignment: Map<string, RoutingOrder[]>; unassignedOrderIds: string[] } {
  const assignment = new Map<string, RoutingOrder[]>();
  for (const rider of riders) assignment.set(rider.id, []);

  const remaining = new Map<string, number>();
  for (const rider of riders) {
    remaining.set(rider.id, Math.max(0, Math.floor(rider.capacity)));
  }

  const unassignedOrderIds: string[] = [];
  const queue = [...orders].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const order of queue) {
    let bestRider: RoutingRider | null = null;
    let bestDistance = Infinity;

    for (const rider of riders) {
      if ((remaining.get(rider.id) ?? 0) <= 0) continue;
      const distance = haversineDistanceKm(order, depotOf(rider));
      if (distance < bestDistance - EPSILON_KM) {
        bestDistance = distance;
        bestRider = rider;
      }
    }

    if (!bestRider) {
      unassignedOrderIds.push(order.id);
      continue;
    }

    assignment.get(bestRider.id)!.push(order);
    remaining.set(bestRider.id, (remaining.get(bestRider.id) ?? 0) - 1);
  }

  return { assignment, unassignedOrderIds };
}

/**
 * Naive scheme used both for the reported baseline and as a second starting point
 * for the improvement step: walk the orders in input order and deal them round-robin
 * to the riders, skipping any rider already at capacity. Visiting order is exactly
 * that arbitrary deal order — no nearest-neighbour, no 2-opt.
 */
function roundRobinAssign(
  orders: RoutingOrder[],
  riders: RoutingRider[],
): Map<string, RoutingOrder[]> {
  const assignment = new Map<string, RoutingOrder[]>();
  for (const rider of riders) assignment.set(rider.id, []);

  if (riders.length === 0) return assignment;

  const remaining = new Map<string, number>();
  for (const rider of riders) {
    remaining.set(rider.id, Math.max(0, Math.floor(rider.capacity)));
  }

  let cursor = 0;
  for (const order of orders) {
    let placed = false;
    for (let attempt = 0; attempt < riders.length; attempt += 1) {
      const rider = riders[(cursor + attempt) % riders.length];
      if ((remaining.get(rider.id) ?? 0) > 0) {
        assignment.get(rider.id)!.push(order);
        remaining.set(rider.id, (remaining.get(rider.id) ?? 0) - 1);
        cursor = (cursor + attempt + 1) % riders.length;
        placed = true;
        break;
      }
    }
    if (!placed) break; // no capacity left anywhere
  }

  return assignment;
}

/**
 * Step 2 — route construction. Nearest-neighbour walk starting at the depot.
 * Ties are broken by order id so the walk is deterministic.
 */
function nearestNeighbourSequence(depot: GeoPoint, orders: RoutingOrder[]): RoutingOrder[] {
  const pool = [...orders].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sequence: RoutingOrder[] = [];
  let current: GeoPoint = depot;

  while (pool.length > 0) {
    let bestIndex = 0;
    let bestDistance = haversineDistanceKm(current, pool[0]);

    for (let i = 1; i < pool.length; i += 1) {
      const distance = haversineDistanceKm(current, pool[i]);
      if (distance < bestDistance - EPSILON_KM) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    const [next] = pool.splice(bestIndex, 1);
    sequence.push(next);
    current = next;
  }

  return sequence;
}

/**
 * Step 3 — 2-opt improvement on an open path. Repeatedly reverse the segment
 * between positions i..j and keep the reversal when it shortens the route.
 * Best-improvement, scanned in a fixed order, so the fixed point is deterministic.
 * The returned route is never longer than the one passed in.
 */
function twoOpt(depot: GeoPoint, initial: RoutingOrder[]): RoutingOrder[] {
  let best = [...initial];
  if (best.length < 3) return best;

  let bestDistance = pathDistanceKm(depot, best);

  for (let pass = 0; pass < MAX_TWO_OPT_PASSES; pass += 1) {
    let improvedDistance = bestDistance;
    let improvedRoute: RoutingOrder[] | null = null;

    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const candidateDistance = pathDistanceKm(depot, candidate);
        if (candidateDistance < improvedDistance - EPSILON_KM) {
          improvedDistance = candidateDistance;
          improvedRoute = candidate;
        }
      }
    }

    if (!improvedRoute) break;
    best = improvedRoute;
    bestDistance = improvedDistance;
  }

  return best;
}

interface Solution {
  routes: RiderRoute[];
  totalDistanceKm: number;
}

function buildSolution(
  riders: RoutingRider[],
  sequences: Map<string, RoutingOrder[]>,
): Solution {
  const routes: RiderRoute[] = riders.map((rider) => {
    const sequence = sequences.get(rider.id) ?? [];
    return {
      riderId: rider.id,
      stops: toStops(sequence),
      distanceKm: pathDistanceKm(depotOf(rider), sequence),
    };
  });

  const totalDistanceKm = routes.reduce((sum, route) => sum + route.distanceKm, 0);
  return { routes, totalDistanceKm };
}

/**
 * Optimize delivery routes: greedy nearest-depot assignment, nearest-neighbour
 * construction, 2-opt improvement — plus a second candidate seeded from the naive
 * round-robin assignment, also 2-opt'd. Whichever candidate is shorter wins, which
 * is why the optimized total can never come out worse than the reported baseline.
 */
export function optimizeRoutes(
  orders: RoutingOrder[],
  riders: RoutingRider[],
): OptimizationResult {
  if (riders.length === 0) {
    return {
      routes: [],
      unassignedOrderIds: [...orders]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((order) => order.id),
      totalDistanceKm: 0,
      naiveBaselineDistanceKm: 0,
    };
  }

  const { assignment, unassignedOrderIds } = greedyAssign(orders, riders);

  // The baseline must cover exactly the orders the optimizer actually served,
  // otherwise the before/after comparison would be over two different order sets.
  const unassigned = new Set(unassignedOrderIds);
  const servedOrders = orders.filter((order) => !unassigned.has(order.id));

  // --- Baseline: round-robin assignment, visited in that arbitrary deal order ---
  const baselineAssignment = roundRobinAssign(servedOrders, riders);
  const baseline = buildSolution(riders, baselineAssignment);

  // --- Candidate A: greedy assignment + nearest-neighbour + 2-opt ---
  const candidateA = new Map<string, RoutingOrder[]>();
  for (const rider of riders) {
    const depot = depotOf(rider);
    const assigned = assignment.get(rider.id) ?? [];
    candidateA.set(rider.id, twoOpt(depot, nearestNeighbourSequence(depot, assigned)));
  }
  const solutionA = buildSolution(riders, candidateA);

  // --- Candidate B: baseline assignment, improved in place with 2-opt ---
  // Seeded from the baseline's own visiting order, so it can only be shorter.
  const candidateB = new Map<string, RoutingOrder[]>();
  for (const rider of riders) {
    const depot = depotOf(rider);
    candidateB.set(rider.id, twoOpt(depot, baselineAssignment.get(rider.id) ?? []));
  }
  const solutionB = buildSolution(riders, candidateB);

  // Ties go to candidate A (the "real" heuristic) so the result stays deterministic.
  const best =
    solutionB.totalDistanceKm < solutionA.totalDistanceKm - EPSILON_KM ? solutionB : solutionA;

  return {
    routes: best.routes,
    unassignedOrderIds,
    totalDistanceKm: best.totalDistanceKm,
    naiveBaselineDistanceKm: baseline.totalDistanceKm,
  };
}
