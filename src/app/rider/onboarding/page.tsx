"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function RiderOnboardingPage() {
  const router = useRouter();
  const [capacity, setCapacity] = useState(10);
  const [depotLat, setDepotLat] = useState("");
  const [depotLng, setDepotLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        setError(`Couldn't get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!depotLat || !depotLng) {
      setError("Set your starting location to continue.");
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
      setError(json.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    router.push("/rider");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-cyan/20 blur-[120px]" />
        <div className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-amber/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/40"
      >
        <h1 className="mb-1 font-display text-lg font-semibold">One last thing</h1>
        <p className="mb-6 text-xs text-text-dim">Tell us where you start your day so we can route deliveries to you.</p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              Max orders per route
            </label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-cyan"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              Starting location (depot)
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="mb-2 w-full rounded-lg border border-cyan/40 bg-cyan/10 py-2 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20 disabled:opacity-50"
            >
              {locating ? "Locating…" : "Use my current location"}
            </button>
            <div className="flex gap-2">
              <input
                placeholder="Latitude"
                value={depotLat}
                onChange={(e) => setDepotLat(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-cyan"
              />
              <input
                placeholder="Longitude"
                value={depotLng}
                onChange={(e) => setDepotLng(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-cyan"
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
            className="w-full rounded-lg bg-cyan py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Start receiving deliveries"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
