"use client";

import { useLanguage } from "@/components/LanguageProvider";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface text-sm text-text-dim">
      {t("common.loadingMap")}
    </div>
  );
}

const LocationPickerMap = dynamic(() => import("./LocationPickerMap").then((m) => m.LocationPickerMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

export type AddressGuess = {
  houseNo?: string;
  street?: string;
  locality?: string;
  displayName: string;
};

type Suggestion = { label: string; lat: number; lng: number };

async function reverseGeocode(lat: number, lng: number): Promise<AddressGuess | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.address ?? {};
    return {
      houseNo: a.house_number,
      street: a.road,
      locality: a.suburb || a.neighbourhood || a.city_district || a.village || a.town || a.city,
      displayName: json.display_name ?? "",
    };
  } catch {
    return null;
  }
}

async function searchPlaces(q: string): Promise<Suggestion[]> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json as { display_name: string; lat: string; lon: string }[]).map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}

export function LocationPickerModal({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  initialLat: number;
  initialLng: number;
  onConfirm: (lat: number, lng: number, guess: AddressGuess | null) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; token: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [addressGuess, setAddressGuess] = useState<AddressGuess | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(value);
      setSuggestions(results);
      setSearching(false);
    }, 400);
  }

  function handleCenterChange(lat: number, lng: number) {
    setCenter({ lat, lng });
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    setGeocoding(true);
    geocodeDebounceRef.current = setTimeout(async () => {
      const guess = await reverseGeocode(lat, lng);
      setAddressGuess(guess);
      setGeocoding(false);
    }, 600);
  }

  useEffect(() => {
    handleCenterChange(initialLat, initialLng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex flex-col bg-bg"
      >
        <div className="relative flex-grow overflow-hidden">
          <LocationPickerMap initialLat={initialLat} initialLng={initialLng} onChange={handleCenterChange} flyToSignal={flyTo} />

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

          <div className="absolute inset-x-0 top-0 z-[1000] flex items-start gap-2 p-4">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/95 text-text shadow-lg backdrop-blur"
            >
              ←
            </button>
            <div className="relative flex-grow">
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={t("picker.searchPlaceholder")}
                className="w-full rounded-full border border-border bg-surface/95 px-4 py-3 text-sm shadow-lg outline-none backdrop-blur focus:border-amber"
              />
              {searching && (
                <span className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-amber border-t-transparent" />
              )}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    key="picker-suggestions"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFlyTo({ lat: s.lat, lng: s.lng, token: Date.now() });
                          setQuery(s.label);
                          setSuggestions([]);
                        }}
                        className="block w-full border-b border-border px-4 py-2.5 text-left text-xs text-text-dim last:border-0 hover:bg-surface-raised hover:text-text"
                      >
                        {s.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="absolute bottom-4 right-4 z-[1000] flex items-center gap-2 rounded-full border border-amber/40 bg-surface/90 px-3.5 py-2.5 text-xs font-semibold text-amber shadow-lg backdrop-blur disabled:opacity-50"
          >
            {locating ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            ) : (
              "📍"
            )}
            {locating ? t("common.locating") : t("picker.useMyLocation")}
          </button>

          {error && (
            <p className="absolute left-1/2 top-24 z-[1000] max-w-xs -translate-x-1/2 rounded-lg border border-danger/30 bg-surface/95 px-3 py-2 text-center text-xs text-danger backdrop-blur">
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
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-dim">{t("tracking.deliveringTo")}</p>
          <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm text-text">
            {geocoding ? (
              <span className="text-text-dim">{t("picker.findingAddress")}</span>
            ) : (
              addressGuess?.displayName ?? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
            )}
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onConfirm(center.lat, center.lng, addressGuess)}
            className="w-full rounded-xl bg-amber py-3.5 text-sm font-bold text-bg shadow-lg shadow-amber/20"
          >
            {t("picker.confirm")}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
