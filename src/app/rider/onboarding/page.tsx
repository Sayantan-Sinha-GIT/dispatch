"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AuthShell } from "@/components/auth/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

export default function RiderOnboardingPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [capacity, setCapacity] = useState(10);
  const [depotLat, setDepotLat] = useState("");
  const [depotLng, setDepotLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A rider who has already set up has nothing to do here: go to work.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rider } = await supabase.from("riders").select("id").eq("profile_id", data.user.id).maybeSingle();
      if (rider) router.replace("/rider");
    });
  }, [router]);

  function useMyLocation() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDepotLat(pos.coords.latitude.toFixed(6));
        setDepotLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setError(t("rider.err.geolocation", { message: err.message }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!depotLat || !depotLng) {
      setError(t("rider.onboarding.err.noLocation"));
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/rider/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity, depotLat: parseFloat(depotLat), depotLng: parseFloat(depotLng) }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? t("common.err.generic"));
      setLoading(false);
      return;
    }
    router.replace("/rider");
    router.refresh();
  }

  return (
    <AuthShell role="rider" headline={t("rider.onboarding.title")} sub={t("roles.rider.desc")}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em]">{t("rider.onboarding.title")}</h2>
        <p className="mb-6 mt-1.5 text-sm text-text-dim">{t("rider.onboarding.subtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="onboarding-capacity" className="mb-1.5 block text-xs font-medium text-text-dim">
              {t("rider.signup.capacity")}
            </label>
            <input
              id="onboarding-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full rounded-2xl border border-transparent bg-surface-raised px-4 py-3 text-sm outline-none focus:border-zest"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-dim">
              {t("rider.signup.depot")}
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="mb-2 w-full rounded-lg border border-zest/40 bg-zest/10 py-2 text-sm font-medium text-zest transition-colors hover:bg-zest/20 disabled:opacity-50"
            >
              {locating ? t("common.locating") : t("common.useMyLocation")}
            </button>
            <div className="flex gap-2">
              <input
                placeholder={t("common.ph.lat")}
                value={depotLat}
                onChange={(e) => setDepotLat(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-surface-raised px-3 py-2 text-sm outline-none focus:border-zest"
              />
              <input
                placeholder={t("common.ph.lng")}
                value={depotLng}
                onChange={(e) => setDepotLng(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-surface-raised px-3 py-2 text-sm outline-none focus:border-zest"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-lime py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("common.saving") : t("rider.onboarding.submit")}
          </motion.button>
        </form>
      </motion.div>
    </AuthShell>
  );
}
