"use client";

import dynamic from "next/dynamic";
import { useLanguage } from "@/components/LanguageProvider";
import type { MapOrder, MapRider } from "./RouteMap";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface text-sm text-text-dim">
      {t("common.loadingMap")}
    </div>
  );
}

const RouteMap = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function RouteMapClient(props: {
  orders: MapOrder[];
  riders: MapRider[];
  focusRiderId?: string | null;
  focusOrderId?: string | null;
  showLocateMe?: boolean;
}) {
  return <RouteMap {...props} />;
}
