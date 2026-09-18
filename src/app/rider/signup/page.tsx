"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { AuthBackground } from "@/components/AuthBackground";

export default function RiderSignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    capacity: 10,
    depotLat: "",
    depotLng: "",
  });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function useMyLocation() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          depotLat: pos.coords.latitude.toFixed(6),
          depotLng: pos.coords.longitude.toFixed(6),
        }));
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
    setError(null);
    setNotice(null);

    if (!form.depotLat || !form.depotLng) {
      setError(t("rider.signup.err.noLocation"));
      return;
    }

    setLoading(true);

    const res = await fetch("/api/rider/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        capacity: form.capacity,
        depotLat: parseFloat(form.depotLat),
        depotLng: parseFloat(form.depotLng),
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? t("rider.signup.err.failed"));
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (signInError) {
      setNotice(t("rider.signup.notice.created"));
      setLoading(false);
      return;
    }

    router.push("/rider");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthBackground accent="cyan" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/40"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan text-bg font-display font-bold">
            D
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold leading-none">{t("rider.signup.title")}</h1>
            <p className="text-xs text-text-dim">Dispatch</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-cyan"
              placeholder={t("rider.signup.ph.name")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-cyan"
              placeholder={t("login.ph.email")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-cyan"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              Max orders per route
            </label>
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
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
              {locating ? t("common.locating") : t("common.useMyLocation")}
            </button>
            <div className="flex gap-2">
              <input
                placeholder={t("common.ph.lat")}
                value={form.depotLat}
                onChange={(e) => setForm((f) => ({ ...f, depotLat: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-cyan"
              />
              <input
                placeholder={t("common.ph.lng")}
                value={form.depotLng}
                onChange={(e) => setForm((f) => ({ ...f, depotLng: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-cyan"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              {notice}
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("rider.signup.creating") : "Sign up"}
          </motion.button>
        </form>

        <p className="mt-5 text-center text-xs text-text-dim">
          {t("rider.signup.haveAccount")}{" "}
          <Link href="/login?role=rider" className="text-cyan hover:underline">
            Log in
          </Link>
        </p>
        <p className="mt-1 text-center text-xs text-text-dim">
          {t("rider.signup.dispatcher")}{" "}
          <Link href="/login?role=admin" className="text-amber hover:underline">
            Admin login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
