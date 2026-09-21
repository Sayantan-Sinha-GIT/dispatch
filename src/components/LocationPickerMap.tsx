"use client";

import { useEffect } from "react";
import { MapContainer, useMapEvents } from "react-leaflet";
import { ThemedTileLayer } from "@/components/ThemedTileLayer";
import "leaflet/dist/leaflet.css";

function MapController({
  onMove,
  flyToSignal,
}: {
  onMove: (lat: number, lng: number) => void;
  flyToSignal: { lat: number; lng: number; token: number } | null;
}) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      onMove(c.lat, c.lng);
    },
  });

  useEffect(() => {
    const c = map.getCenter();
    onMove(c.lat, c.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flyToSignal) {
      map.flyTo([flyToSignal.lat, flyToSignal.lng], 16, { duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToSignal?.token]);

  return null;
}

export function LocationPickerMap({
  initialLat,
  initialLng,
  onChange,
  flyToSignal,
}: {
  initialLat: number;
  initialLng: number;
  onChange: (lat: number, lng: number) => void;
  flyToSignal: { lat: number; lng: number; token: number } | null;
}) {
  return (
    <MapContainer center={[initialLat, initialLng]} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <ThemedTileLayer />
      <MapController onMove={onChange} flyToSignal={flyToSignal} />
    </MapContainer>
  );
}
