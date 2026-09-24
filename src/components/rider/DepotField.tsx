"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { useLanguage } from "@/components/LanguageProvider";

export type Point = { lat: number; lng: number };

const KOLKATA: Point = { lat: 22.5726, lng: 88.3639 };

/**
 * Where a rider starts their day, chosen the way people choose places: from
 * their phone's GPS, or by searching and dropping a pin on the map. Once set
 * it reads as an address, never as coordinates - nobody should have to type
 * a latitude.
 */
export function DepotField({ value, onChange }: { value: Point | null; onChange: (p: Point) => void }) {
  const { t } = useLanguage();
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // Name the chosen point. Stale answers are dropped if the rider moves it again.
  useEffect(() => {
    if (!value) return;
    let live = true;
    fetch(`/api/places/reverse?lat=${value.lat}&lng=${value.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { address?: { displayName?: string } } | null) => {
        if (live) setAddress(j?.address?.displayName || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [value]);

  function useMyLocation() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAddress(null);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setError(t("rider.err.geolocation", { message: err.message }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const pinIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-text-dim">{t("rider.signup.depot")}</p>

      {value ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-raised p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime text-ink">{pinIcon}</span>
          <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug">
            {address ?? <span className="text-text-dim">{t("picker.findingAddress")}</span>}
          </p>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-xs font-medium ring-1 ring-border transition-colors hover:ring-zest"
          >
            {t("rider.depot.change")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center justify-center gap-1.5 rounded-full bg-lime px-3 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {locating ? t("common.locating") : t("rider.depot.useGps")}
          </button>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex items-center justify-center gap-1.5 rounded-full bg-surface-raised px-3 py-3 text-sm font-medium ring-1 ring-border transition-colors hover:ring-zest"
          >
            {pinIcon}
            {t("rider.depot.chooseOnMap")}
          </button>
        </div>
      )}

      {value && (
        <button type="button" onClick={useMyLocation} disabled={locating} className="mt-2 text-xs font-medium text-zest disabled:opacity-50">
          {locating ? t("common.locating") : t("rider.depot.useGpsInstead")}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <AnimatePresence>
        {picking && (
          <LocationPickerModal
            key="depot-picker"
            initialLat={value?.lat ?? KOLKATA.lat}
            initialLng={value?.lng ?? KOLKATA.lng}
            onClose={() => setPicking(false)}
            onConfirm={(lat, lng, guess) => {
              setAddress(guess?.displayName || null);
              onChange({ lat, lng });
              setPicking(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
