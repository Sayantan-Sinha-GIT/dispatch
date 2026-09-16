export interface RoutingOrder {
  id: string;
  lat: number;
  lng: number;
  weight: number;
}

export interface RoutingRider {
  id: string;
  capacity: number; // max number of orders
  depotLat: number;
  depotLng: number;
}

export interface RouteStop {
  orderId: string;
  sequence: number; // 0-indexed position in this rider's route
}

export interface RiderRoute {
  riderId: string;
  stops: RouteStop[]; // in visiting order
  distanceKm: number; // total route distance including depot legs
}

export interface OptimizationResult {
  routes: RiderRoute[];
  unassignedOrderIds: string[]; // orders that couldn't be assigned (no rider capacity) — should be empty in the normal case
  totalDistanceKm: number;
  naiveBaselineDistanceKm: number;
}
