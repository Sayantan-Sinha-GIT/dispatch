/**
 * Great-circle distance between two lat/lng points, in kilometres.
 * Standard haversine formula with a spherical Earth radius of 6371 km.
 */

export const EARTH_RADIUS_KM = 6371;

export interface GeoPoint {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  // Clamp guards against floating-point drift pushing h marginally above 1.
  const c = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));

  return EARTH_RADIUS_KM * c;
}
