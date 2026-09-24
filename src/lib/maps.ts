/**
 * Hand-off links into Google Maps, so a rider gets real turn-by-turn directions
 * instead of reading a street name off our small map.
 *
 * These are Google's universal Maps URLs: on a phone with the Maps app
 * installed, Android and iOS open the app straight into directions; anywhere
 * else they open maps in the browser. With no origin given, Maps starts from
 * the device's own location, which is always where the rider actually is.
 * Coordinates rather than the typed address, because the pin is what the
 * customer placed and a free-text address can geocode somewhere else.
 */

const BASE = "https://www.google.com/maps/dir/?";

type Point = { lat: number; lng: number };

const at = (p: Point) => `${p.lat},${p.lng}`;

/** Directions to one stop, starting navigation straight away. */
export function directionsUrl(stop: Point): string {
  return (
    BASE +
    new URLSearchParams({
      api: "1",
      destination: at(stop),
      travelmode: "two-wheeler",
      dir_action: "navigate",
    })
  );
}

/**
 * The whole run in delivery order: the last stop is the destination and the
 * rest are waypoints. Google accepts up to nine waypoints, so a longer run is
 * cut to the next ten stops; the rider reopens it after those.
 */
export const MAX_ROUTE_STOPS = 10;

export function routeUrl(stops: Point[]): string {
  const run = stops.slice(0, MAX_ROUTE_STOPS);
  const params = new URLSearchParams({
    api: "1",
    destination: at(run[run.length - 1]),
    travelmode: "two-wheeler",
  });
  if (run.length > 1) params.set("waypoints", run.slice(0, -1).map(at).join("|"));
  return BASE + params;
}
