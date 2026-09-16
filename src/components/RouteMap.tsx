"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const ROUTE_COLORS = ["#ffb020", "#2dd4c4", "#ff5470", "#8b7bff", "#3ddc97", "#ff8fa3"];

export interface MapOrder {
  id: string;
  lat: number;
  lng: number;
  address: string;
  status: string;
  assigned_rider_id: string | null;
  sequence_in_route: number | null;
}

export interface MapRider {
  id: string;
  depot_lat: number;
  depot_lng: number;
  name: string;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

function AnimatedRoute({
  positions,
  color,
}: {
  positions: [number, number][];
  color: string;
}) {
  const [revealed, setRevealed] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the reveal animation when a new route is drawn
    setRevealed(1);
    if (positions.length < 2) return;
    const totalSteps = positions.length;
    let step = 1;
    const interval = setInterval(() => {
      step += 1;
      setRevealed(step);
      if (step >= totalSteps) clearInterval(interval);
    }, 350);
    return () => clearInterval(interval);
  }, [positions]);

  const visible = positions.slice(0, revealed);
  const markerPos = positions[Math.min(revealed - 1, positions.length - 1)];

  if (visible.length < 2) return null;

  return (
    <>
      <Polyline positions={visible} pathOptions={{ color, weight: 4, opacity: 0.9 }} />
      {markerPos && (
        <Marker
          position={markerPos}
          icon={L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}33"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })}
        />
      )}
    </>
  );
}

export function RouteMap({
  orders,
  riders,
}: {
  orders: MapOrder[];
  riders: MapRider[];
}) {
  // Captured once on mount; all subsequent view changes go through FitBounds
  // via the map instance directly, since MapContainer only honors center/zoom
  // on first render and re-passing a fresh array each render fights fitBounds.
  const [initialCenter] = useState<[number, number]>(() =>
    riders.length > 0
      ? [riders[0].depot_lat, riders[0].depot_lng]
      : orders.length > 0
        ? [orders[0].lat, orders[0].lng]
        : [12.9716, 77.5946],
  );

  const allPoints = useMemo<[number, number][]>(
    () => [
      ...riders.map((r) => [r.depot_lat, r.depot_lng] as [number, number]),
      ...orders.map((o) => [o.lat, o.lng] as [number, number]),
    ],
    [riders, orders],
  );

  const routesByRider = useMemo(() => {
    return riders.map((rider, idx) => {
      const riderOrders = orders
        .filter((o) => o.assigned_rider_id === rider.id)
        .sort((a, b) => (a.sequence_in_route ?? 0) - (b.sequence_in_route ?? 0));
      const positions: [number, number][] = [
        [rider.depot_lat, rider.depot_lng],
        ...riderOrders.map((o) => [o.lat, o.lng] as [number, number]),
      ];
      return { rider, positions, color: ROUTE_COLORS[idx % ROUTE_COLORS.length] };
    });
  }, [riders, orders]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={12}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FitBounds points={allPoints} />

      {riders.map((rider) => (
        <Marker
          key={rider.id}
          position={[rider.depot_lat, rider.depot_lng]}
          icon={L.divIcon({
            className: "",
            html: `<div style="width:16px;height:16px;border-radius:4px;background:#e8ecf1;border:2px solid #0a0d12"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        >
          <Popup>Depot — {rider.name}</Popup>
        </Marker>
      ))}

      {orders.map((order) => (
        <Marker key={order.id} position={[order.lat, order.lng]} icon={DEFAULT_ICON}>
          <Popup>
            {order.address}
            <br />
            {order.status}
          </Popup>
        </Marker>
      ))}

      {routesByRider.map(({ rider, positions, color }) => (
        <AnimatedRoute key={rider.id} positions={positions} color={color} />
      ))}
    </MapContainer>
  );
}
