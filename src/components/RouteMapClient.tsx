"use client";

import dynamic from "next/dynamic";
import type { MapOrder, MapRider } from "./RouteMap";

const RouteMap = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface text-sm text-text-dim">
      Loading map…
    </div>
  ),
});

export function RouteMapClient(props: {
  orders: MapOrder[];
  riders: MapRider[];
  focusRiderId?: string | null;
  showLocateMe?: boolean;
}) {
  return <RouteMap {...props} />;
}
