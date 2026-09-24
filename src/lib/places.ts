/**
 * Place search and reverse geocoding for the location picker. Server-side
 * only: it holds the Ola Maps key.
 *
 * Ola Maps comes first because it knows Indian shops, offices and landmarks
 * the way Google Maps does ("Annapurna Builders, Behala"); OpenStreetMap,
 * which the picker used alone before, has few of them. When Ola is not
 * configured, fails or finds nothing, OpenStreetMap's Nominatim answers
 * instead, so search never simply stops working.
 */

export type PlaceSuggestion = {
  /** The place itself, e.g. "Annapurna Builders". */
  title: string;
  /** Where it is, e.g. "B G Press Colony, Behala, Kolkata". */
  subtitle: string;
  lat: number;
  lng: number;
  /** From the point the search was biased to, when known. */
  distanceM?: number;
};

export type PlaceAddress = {
  houseNo?: string;
  street?: string;
  locality?: string;
  displayName: string;
};

type Point = { lat: number; lng: number };

const OLA = "https://api.olamaps.io/places/v1";
const NOMINATIM = "https://nominatim.openstreetmap.org";
// Nominatim's usage policy asks for an identifying User-Agent.
const NOMINATIM_HEADERS = { "User-Agent": "Dispatch/1.0 (https://dispatch-delivery.vercel.app)", "Accept-Language": "en" };

function olaKey(): string | undefined {
  return process.env.OLA_MAPS_API_KEY || undefined;
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

function haversineM(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---- search --------------------------------------------------------------- */

type OlaPrediction = {
  description?: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
  geometry?: { location?: { lat?: number; lng?: number } };
  distance_meters?: number;
};

async function olaSearch(q: string, near: Point | null, key: string): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ input: q, api_key: key });
  // Bias toward where the map is, as Google does, without excluding the rest.
  if (near) {
    params.set("location", `${near.lat},${near.lng}`);
    params.set("radius", "50000");
  }
  const json = (await getJson(`${OLA}/autocomplete?${params}`, { "X-Request-Id": crypto.randomUUID() })) as {
    predictions?: OlaPrediction[];
  };
  return (json.predictions ?? []).flatMap((p) => {
    const lat = p.geometry?.location?.lat;
    const lng = p.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return [];
    const title = p.structured_formatting?.main_text || p.description?.split(",")[0] || "";
    const subtitle = p.structured_formatting?.secondary_text || p.description?.split(",").slice(1).join(",").trim() || "";
    return [
      {
        title,
        subtitle,
        lat,
        lng,
        distanceM: typeof p.distance_meters === "number" ? p.distance_meters : near ? haversineM(near, { lat, lng }) : undefined,
      },
    ];
  });
}

async function nominatimSearch(q: string, near: Point | null): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ format: "jsonv2", q, limit: "6", countrycodes: "in", addressdetails: "0" });
  if (near) {
    // A ~60 km box around the map, preferred but not enforced.
    params.set("viewbox", `${near.lng - 0.3},${near.lat + 0.3},${near.lng + 0.3},${near.lat - 0.3}`);
  }
  const json = (await getJson(`${NOMINATIM}/search?${params}`, NOMINATIM_HEADERS)) as {
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
  }[];
  return json.map((r) => {
    const parts = r.display_name.split(",").map((s) => s.trim());
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    return {
      title: r.name || parts[0],
      subtitle: parts.slice(1).join(", "),
      lat,
      lng,
      distanceM: near ? haversineM(near, { lat, lng }) : undefined,
    };
  });
}

/** `useOla: false` keeps a request on the free OpenStreetMap service. */
export async function searchPlaces(q: string, near: Point | null, useOla = true): Promise<PlaceSuggestion[]> {
  const key = useOla ? olaKey() : undefined;
  if (key) {
    try {
      const results = await olaSearch(q, near, key);
      // Ola ranks by name; several Indian businesses share one. As on Google
      // Maps, the one near where the person is looking should come first.
      if (near) results.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
      if (results.length > 0) return results.slice(0, 8);
    } catch (e) {
      console.error("[places] Ola search failed, using OpenStreetMap:", (e as Error).message);
    }
  }
  try {
    return await nominatimSearch(q, near);
  } catch (e) {
    console.error("[places] Nominatim search failed:", (e as Error).message);
    return [];
  }
}

/* ---- reverse geocoding ------------------------------------------------------ */

type OlaComponent = { long_name?: string; types?: string[] };

async function olaReverse(p: Point, key: string): Promise<PlaceAddress | null> {
  const params = new URLSearchParams({ latlng: `${p.lat},${p.lng}`, api_key: key });
  const json = (await getJson(`${OLA}/reverse-geocode?${params}`, { "X-Request-Id": crypto.randomUUID() })) as {
    results?: { formatted_address?: string; address_components?: OlaComponent[] }[];
  };
  const best = json.results?.[0];
  if (!best?.formatted_address) return null;
  const find = (...types: string[]) =>
    best.address_components?.find((c) => c.types?.some((t) => types.includes(t)))?.long_name || undefined;
  return {
    houseNo: find("street_number", "premise"),
    street: find("route"),
    locality: find("sublocality", "sublocality_level_1", "neighborhood", "locality"),
    displayName: best.formatted_address,
  };
}

async function nominatimReverse(p: Point): Promise<PlaceAddress | null> {
  const params = new URLSearchParams({ format: "jsonv2", lat: String(p.lat), lon: String(p.lng), addressdetails: "1" });
  const json = (await getJson(`${NOMINATIM}/reverse?${params}`, NOMINATIM_HEADERS)) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const a = json.address ?? {};
  return {
    houseNo: a.house_number,
    street: a.road,
    locality: a.suburb || a.neighbourhood || a.city_district || a.village || a.town || a.city,
    displayName: json.display_name ?? "",
  };
}

export async function reverseGeocode(p: Point, useOla = true): Promise<PlaceAddress | null> {
  const key = useOla ? olaKey() : undefined;
  if (key) {
    try {
      const result = await olaReverse(p, key);
      if (result) return result;
    } catch (e) {
      console.error("[places] Ola reverse geocode failed, using OpenStreetMap:", (e as Error).message);
    }
  }
  try {
    return await nominatimReverse(p);
  } catch (e) {
    console.error("[places] Nominatim reverse failed:", (e as Error).message);
    return null;
  }
}
