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
  /** Set when the pin came from a searched place, e.g. "Annapurna Builders". */
  landmark?: string;
  displayName: string;
};

type Suggestion = { title: string; subtitle: string; lat: number; lng: number; distanceM?: number };

/*
 * Both lookups go through the app's own server (src/lib/places.ts), which
 * searches Ola Maps - it knows Indian shops and landmarks - and falls back to
 * OpenStreetMap.
 */
async function reverseGeocode(lat: number, lng: number): Promise<AddressGuess | null> {
  try {
    const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { address: AddressGuess | null };
    return json.address;
  } catch {
    return null;
  }
}

async function searchPlaces(q: string, near: { lat: number; lng: number }): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({ q, lat: String(near.lat), lng: String(near.lng) });
    const res = await fetch(`/api/places/search?${params}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { results: Suggestion[] };
    return json.results;
  } catch {
    return [];
  }
}

function formatDistance(m: number | undefined): string | null {
  if (m === undefined) return null;
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Roughly metres between two nearby points; plenty for "is this still the picked place". */
function nearM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
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
  const [noResults, setNoResults] = useState(false);
  /** The searched place the pin was sent to, until the map is dragged off it. */
  const pickedRef = useRef<Suggestion | null>(null);
  const centerRef = useRef({ lat: initialLat, lng: initialLng });
  const searchSeqRef = useRef(0);
  const [addressGuess, setAddressGuess] = useState<AddressGuess | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyTokenRef = useRef(0);

  /**
   * Move the pin to a chosen point.
   *
   * The map is asked to fly there *and* the centre is committed immediately.
   * Relying on the map's `moveend` alone meant a confirmed pin could still be
   * the location the map opened at — a customer who searched for a Kolkata
   * street could place an order against the previous coordinates entirely.
   */
  function moveTo(lat: number, lng: number, picked: Suggestion | null = null) {
    pickedRef.current = picked;
    // The token only has to differ from the last one to re-trigger the fly.
    flyTokenRef.current += 1;
    setFlyTo({ lat, lng, token: flyTokenRef.current });
    handleCenterChange(lat, lng);
  }

  function useMyLocation() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        moveTo(pos.coords.latitude, pos.coords.longitude);
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
    setNoResults(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      // Answers can come back out of order; only the latest query may land.
      const seq = ++searchSeqRef.current;
      const results = await searchPlaces(value.trim(), centerRef.current);
      if (seq !== searchSeqRef.current) return;
      setSuggestions(results);
      setNoResults(results.length === 0);
      setSearching(false);
    }, 350);
  }

  function pickSuggestion(s: Suggestion) {
    moveTo(s.lat, s.lng, s);
    setQuery(s.title);
    setSuggestions([]);
    setNoResults(false);
    // Show the place's own name straight away; the street details follow.
    setAddressGuess({ landmark: s.title, displayName: [s.title, s.subtitle].filter(Boolean).join(", ") });
  }

  function handleCenterChange(lat: number, lng: number) {
    setCenter({ lat, lng });
    centerRef.current = { lat, lng };
    const picked = pickedRef.current;
    const onPicked = !!picked && nearM(picked, { lat, lng }) < 40;
    if (!onPicked) pickedRef.current = null;
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    if (!onPicked) setGeocoding(true);
    geocodeDebounceRef.current = setTimeout(async () => {
      const guess = await reverseGeocode(lat, lng);
      const still = pickedRef.current;
      // Still on the searched place: keep its name as the headline and as the
      // landmark, and take only the street details from the lookup.
      setAddressGuess(
        still
          ? {
              ...guess,
              landmark: still.title,
              displayName: [still.title, still.subtitle].filter(Boolean).join(", "),
            }
          : guess,
      );
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
        className="fixed inset-0 z-[2000] flex flex-col bg-bg pb-[var(--safe-bottom)] pt-[var(--safe-top)]"
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
                <path d="M18 0C8 0 0 8 0 18c0 13.5 18 28 18 28s18-14.5 18-28C36 8 28 0 18 0Z" fill="#6b4ef0" />
                <circle cx="18" cy="18" r="7" fill="#c8f34a" />
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full card-soft border border-transparent bg-surface/95 text-text shadow-lg backdrop-blur"
            >
              ←
            </button>
            <div className="relative flex-grow">
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && suggestions[0]) pickSuggestion(suggestions[0]);
                }}
                enterKeyHint="search"
                placeholder={t("picker.searchPlaceholder")}
                className="w-full rounded-full card-soft border border-transparent bg-surface/95 px-4 py-3 text-sm shadow-lg outline-none backdrop-blur focus:border-brand"
              />
              {searching && (
                <span className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              )}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    key="picker-suggestions"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl card-soft border border-transparent bg-surface shadow-2xl"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={`${s.lat},${s.lng},${i}`}
                        type="button"
                        onClick={() => pickSuggestion(s)}
                        className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-surface-raised"
                      >
                        <span className="flex w-10 shrink-0 flex-col items-center gap-0.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-dim">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                              <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                            </svg>
                          </span>
                          {formatDistance(s.distanceM) && (
                            <span className="whitespace-nowrap text-[10px] text-text-dim">{formatDistance(s.distanceM)}</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text">{s.title}</span>
                          {s.subtitle && <span className="block truncate text-xs text-text-dim">{s.subtitle}</span>}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
                {noResults && !searching && query.trim().length >= 3 && (
                  <motion.p
                    key="picker-empty"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-x-0 top-full mt-2 rounded-2xl card-soft bg-surface px-4 py-3 text-xs text-text-dim shadow-2xl"
                  >
                    {t("picker.noResults")}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="absolute bottom-4 right-4 z-[1000] flex items-center gap-2 rounded-full border border-brand/40 bg-surface/90 px-3.5 py-2.5 text-xs font-semibold text-brand shadow-lg backdrop-blur disabled:opacity-50"
          >
            {locating ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
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
            className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-bg shadow-lg shadow-brand/20"
          >
            {t("picker.confirm")}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
