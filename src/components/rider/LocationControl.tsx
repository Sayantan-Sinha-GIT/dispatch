"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { MAX_OFFER_DISTANCE_KM } from "@/lib/serviceArea";
import type { Tables } from "@/lib/supabase/types";

type Rider = Tables<"riders">;

const LIVE_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * Where the rider is dispatched from, and the controls to change it.
 *
 * Previously a rider was stuck forever at whatever depot they typed in at
 * signup: the only thing that could move them was a browser GPS watch, which
 * silently does nothing if permission is denied, if the device has no fix, or
 * on desktop. A rider who had moved city kept being measured from the old one.
 *
 * Three ways to move now, in increasing order of permanence:
 *  - GPS ping (live position, expires after two minutes)
 *  - pick on a map (sets base *and* live position)
 *  - automatic, on delivery: handled server-side, the rider lands at the drop
 */
export function LocationControl({ rider, onChanged }: { rider: Rider; onChanged: () => void }) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // A clock held in state and advanced on a timer, so "is the GPS fix still
  // fresh" goes stale on its own instead of only when something re-renders.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const liveFresh =
    !!rider.location_updated_at &&
    now - new Date(rider.location_updated_at).getTime() < LIVE_MAX_AGE_MS &&
    rider.current_lat != null &&
    rider.current_lng != null;

  const originLat = liveFresh ? rider.current_lat! : rider.depot_lat;
  const originLng = liveFresh ? rider.current_lng! : rider.depot_lng;

  // Name the point in words; coordinates are for machines. Rounded so a GPS
  // fix drifting by a few metres doesn't trigger a new lookup every time.
  const [placeName, setPlaceName] = useState<string | null>(null);
  const keyLat = originLat.toFixed(3);
  const keyLng = originLng.toFixed(3);
  useEffect(() => {
    let live = true;
    fetch(`/api/places/reverse?lat=${keyLat}&lng=${keyLng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { address?: { displayName?: string } } | null) => {
        if (live) setPlaceName(j?.address?.displayName || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [keyLat, keyLng]);

  function flash(kind: "ok" | "err", text: string) {
    setFeedback({ kind, text });
    setTimeout(() => setFeedback(null), 4000);
  }

  function useGps() {
    if (!("geolocation" in navigator)) {
      flash("err", t("rider.loc.noGps"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.rpc("update_my_location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocating(false);
        if (error) {
          flash("err", t("rider.loc.saveFailed"));
          return;
        }
        flash("ok", t("rider.loc.updated"));
        onChanged();
      },
      (err) => {
        setLocating(false);
        // A denied permission is the common case and is not an app failure, so
        // say what to do about it rather than printing the raw browser string.
        flash("err", err.code === err.PERMISSION_DENIED ? t("rider.loc.denied") : t("rider.loc.noFix"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function saveBase(lat: number, lng: number) {
    setSaving(true);
    const { error } = await supabase.rpc("set_my_depot", { lat, lng });
    setSaving(false);
    setPicking(false);
    if (error) {
      flash("err", t("rider.loc.saveFailed"));
      return;
    }
    flash("ok", t("rider.loc.baseUpdated"));
    onChanged();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl card-soft border border-transparent bg-surface p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-dim">{t("rider.loc.title")}</p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-text">
              {placeName ?? <span className="text-text-dim">{t("picker.findingAddress")}</span>}
            </p>
            <p className="mt-0.5 text-[11px] text-text-dim">
              {liveFresh ? t("rider.loc.fromGps") : t("rider.loc.fromBase")}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
              liveFresh ? "bg-success/15 text-success" : "bg-border/60 text-text-dim"
            }`}
          >
            {liveFresh ? t("rider.loc.live") : t("rider.loc.stale")}
          </span>
        </div>

        <p className="mb-3 text-[11px] leading-relaxed text-text-dim">
          {t("rider.loc.radiusHint", { km: MAX_OFFER_DISTANCE_KM })}
        </p>

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={useGps}
            disabled={locating}
            className="flex-1 rounded-xl border border-zest/40 bg-zest/10 py-2.5 text-xs font-semibold text-zest disabled:opacity-50"
          >
            {locating ? t("common.locating") : `📍 ${t("rider.loc.useGps")}`}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => setPicking(true)}
            disabled={saving}
            className="flex-1 rounded-xl border border-border/50 bg-surface-raised py-2.5 text-xs font-semibold text-text disabled:opacity-50"
          >
            {saving ? t("common.saving") : `🗺️ ${t("rider.loc.setOnMap")}`}
          </motion.button>
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.p
              key="loc-feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`mt-2.5 overflow-hidden text-[11px] ${
                feedback.kind === "ok" ? "text-success" : "text-danger"
              }`}
            >
              {feedback.text}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {picking && (
        <LocationPickerModal
          initialLat={originLat}
          initialLng={originLng}
          onConfirm={(lat, lng) => saveBase(lat, lng)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
