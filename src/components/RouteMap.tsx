"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ROUTE_COLORS } from "@/lib/routeColors";

const STATUS_COLORS: Record<string, string> = {
  pending: "#8b96a5",
  offered: "#ffb020",
  expired: "#8b96a5",
  assigned: "#2dd4c4",
  delivered: "#3ddc97",
  failed: "#ff5470",
};

function orderIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "#8b96a5";
  const pulse = status === "offered" ? `box-shadow:0 0 0 6px ${color}33;` : "";
  return L.divIcon({
    className: "",
    html: `<div style="width:15px;height:15px;border-radius:50%;background:${color};border:2px solid #0a0d12;${pulse}"></div>`,
    iconSize: [15, 15],
    iconAnchor: [7, 7],
  });
}

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
  current_lat?: number | null;
  current_lng?: number | null;
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

function FocusRider({ rider }: { rider: MapRider | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!rider) return;
    const lat = rider.current_lat ?? rider.depot_lat;
    const lng = rider.current_lng ?? rider.depot_lng;
    map.flyTo([lat, lng], 15, { duration: 1 });
  }, [rider, map]);
  return null;
}

function LocateMeControl() {
  const map = useMap();
  const [me, setMe] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function handleLocate() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMe(point);
        map.flyTo(point, 15, { duration: 1 });
        setLocating(false);
      },
      (err) => {
        setError(err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        title="Show my current location"
        className="absolute right-3 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-text shadow-lg transition-colors hover:border-amber/50 disabled:opacity-50"
      >
        {locating ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {error && (
        <p className="absolute right-3 top-14 z-[1000] max-w-[200px] rounded-lg border border-danger/30 bg-surface-raised px-2.5 py-1.5 text-[11px] text-danger shadow-lg">
          {error}
        </p>
      )}
      {me && (
        <Marker
          position={me}
          icon={L.divIcon({
            className: "",
            html: `<div style="width:16px;height:16px;border-radius:50%;background:#4f9dff;border:3px solid white;box-shadow:0 0 0 4px rgba(79,157,255,0.35)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}
    </>
  );
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
  focusRiderId = null,
  showLocateMe = false,
}: {
  orders: MapOrder[];
  riders: MapRider[];
  focusRiderId?: string | null;
  showLocateMe?: boolean;
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

  const focusedRider = riders.find((r) => r.id === focusRiderId);

  return (
    <div className="relative h-full w-full">
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
        <FocusRider rider={focusedRider} />
        {showLocateMe && <LocateMeControl />}

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

        {routesByRider.map(({ rider, color }) =>
          rider.current_lat != null && rider.current_lng != null ? (
            <Marker
              key={`live-${rider.id}`}
              position={[rider.current_lat, rider.current_lng]}
              icon={L.divIcon({
                className: "",
                html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 4px ${color}55"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              })}
            >
              <Popup>{rider.name} — live location</Popup>
            </Marker>
          ) : null,
        )}

        {orders.map((order) => (
          <Marker key={order.id} position={[order.lat, order.lng]} icon={orderIcon(order.status)}>
            <Popup>
              {order.address}
              <br />
              <span style={{ color: STATUS_COLORS[order.status], fontWeight: 600, textTransform: "uppercase" }}>
                {order.status}
              </span>
            </Popup>
          </Marker>
        ))}

        {routesByRider.map(({ rider, positions, color }) => (
          <AnimatedRoute key={rider.id} positions={positions} color={color} />
        ))}
      </MapContainer>
    </div>
  );
}
