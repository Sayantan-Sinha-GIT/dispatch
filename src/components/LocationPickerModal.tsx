"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap").then((m) => m.LocationPickerMap), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-surface text-sm text-text-dim">Loading map…</div>,
});

export function LocationPickerModal({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  initialLat: number;
  initialLng: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; token: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude, token: Date.now() });
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex flex-col bg-bg"
      >
        <div className="relative flex-grow overflow-hidden">
          <LocationPickerMap initialLat={initialLat} initialLng={initialLng} onChange={(lat, lng) => setCenter({ lat, lng })} flyToSignal={flyTo} />

          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="relative -mt-6"
            >
              <svg width="36" height="46" viewBox="0 0 36 46" fill="none">
                <path d="M18 0C8 0 0 8 0 18c0 13.5 18 28 18 28s18-14.5 18-28C36 8 28 0 18 0Z" fill="#ffb020" />
                <circle cx="18" cy="18" r="7" fill="#0a0d12" />
              </svg>
              <motion.div
                className="absolute -bottom-1 left-1/2 h-2 w-6 -translate-x-1/2 rounded-full bg-black/40 blur-[2px]"
                animate={{ scaleX: [1, 0.6, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/90 text-text backdrop-blur"
          >
            ←
          </button>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-full border border-amber/40 bg-surface/90 px-3.5 py-2.5 text-xs font-semibold text-amber backdrop-blur disabled:opacity-50"
          >
            {locating ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            ) : (
              "📍"
            )}
            {locating ? "Locating…" : "Use my location"}
          </button>

          {error && (
            <p className="absolute left-1/2 top-20 z-[1000] max-w-xs -translate-x-1/2 rounded-lg border border-danger/30 bg-surface/95 px-3 py-2 text-center text-xs text-danger backdrop-blur">
              {error}
            </p>
          )}
        </div>

        <motion.div
          initial={{ y: 60 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="border-t border-border bg-surface p-5"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-dim">Drag the map to move the pin</p>
          <p className="mb-4 font-mono text-xs text-text-dim">
            {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onConfirm(center.lat, center.lng)}
            className="w-full rounded-xl bg-amber py-3.5 text-sm font-bold text-bg shadow-lg shadow-amber/20"
          >
            Confirm this location
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
