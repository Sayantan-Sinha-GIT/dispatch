import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPlaces } from "@/lib/places";

function coord(v: string | null, limit: number): number | null {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/**
 * Landmark and address search for the location picker. Signed-in users only,
 * so the free Ola Maps allowance is spent on customers and riders, not on
 * whoever finds the URL.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const lat = coord(request.nextUrl.searchParams.get("lat"), 90);
  const lng = coord(request.nextUrl.searchParams.get("lng"), 180);
  const results = await searchPlaces(q, lat !== null && lng !== null ? { lat, lng } : null);
  return NextResponse.json({ results });
}
