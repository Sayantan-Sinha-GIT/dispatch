"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { AuthBackground } from "@/components/AuthBackground";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";

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
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

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

    if (!form.depotLat || !form.depotLng) {
      setError(t("rider.signup.err.noLocation"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("login.err.weakPassword"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // The depot and capacity ride along in user_metadata: the riders row is
    // created once the emailed code is accepted and the account becomes real.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          role: "rider",
          capacity: form.capacity,
          depot_lat: parseFloat(form.depotLat),
          depot_lng: parseFloat(form.depotLng),
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError(t("login.err.emailTaken"));
      return;
    }
    if (data.session) {
      // Email confirmation is switched off for this project — nothing to verify.
      await fetch("/api/auth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "rider" }),
      });
      router.push("/rider");
      router.refresh();
      return;
    }
    setSent(true);
  }

  async function handleResend() {
    setResendState("sending");
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email: form.email });
    setResendState("sent");
  }

  /**
   * Accepting the code creates the session, and /api/auth/finalize then builds
   * the riders row from the depot and capacity carried in user_metadata -
   * exactly what the emailed link used to trigger.
   */
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const supabase = createClient();

    const { error: otpError } = await supabase.auth.verifyOtp({
      email: form.email,
      token: verifyCode.trim(),
      type: "signup",
    });
    if (otpError) {
      setError(t("login.err.badVerifyCode"));
      setVerifying(false);
      return;
    }

    await fetch("/api/auth/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "rider" }),
    });
    setVerifying(false);
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

        {sent ? (
          <VerifyCodeForm
            email={form.email}
            code={verifyCode}
            onCode={setVerifyCode}
            onSubmit={handleVerifyCode}
            onResend={handleResend}
            onBack={() => {
              setSent(false);
              setVerifyCode("");
              setError(null);
            }}
            loading={verifying}
            resendState={resendState}
            error={error}
            accent="cyan"
          />
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
                  {t("rider.signup.name")}
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
                  {t("login.email")}
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
                  {t("login.password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-3.5 pr-11 text-sm outline-none focus:border-cyan"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    title={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    className="absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-dim transition-colors hover:text-text"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-text-dim">{t("login.passwordHint")}</p>
              </div>
              <div>
                <label htmlFor="rider-capacity" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
                  {t("rider.signup.capacity")}
                </label>
                <input
                  id="rider-capacity"
                  type="number"
                  min={1}
                  max={20}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none focus:border-cyan"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
                  {t("rider.signup.depot")}
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

              <p className="text-[11px] text-text-dim">{t("login.verifyNotice")}</p>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-cyan py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? t("rider.signup.creating") : t("login.signUp")}
              </motion.button>
            </form>

            <p className="mt-5 text-center text-xs text-text-dim">
              {t("rider.signup.haveAccount")}{" "}
              <Link href="/login?role=rider" className="text-cyan hover:underline">
                {t("rider.signup.logIn")}
              </Link>
            </p>
            <p className="mt-1 text-center text-xs text-text-dim">
              {t("rider.signup.dispatcher")}{" "}
              <Link href="/login?role=admin" className="text-amber hover:underline">
                {t("rider.signup.adminLogin")}
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
