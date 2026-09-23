"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";

/**
 * Landing spot for a password-recovery link.
 *
 * `/auth/callback` has already exchanged the token by the time anyone gets
 * here, so a live session is the proof that the link was genuine. No session
 * means the link was expired, already spent, or typed in by hand — in every
 * case the only useful answer is "ask for a new one", so we say that instead
 * of showing a form that cannot work.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const role = searchParams.get("role") ?? "customer";

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    /**
     * Two shapes of recovery link reach this page.
     *
     * The PKCE one is already finished by the time we render: /auth/callback
     * exchanged the code server-side and the session is in a cookie.
     *
     * The implicit one hands the session over in the URL fragment
     * (#access_token=...&refresh_token=...&type=recovery). A fragment never
     * reaches the server, so the callback could not act on it and forwarded
     * the request here untouched. Adopting it is the only way that link works
     * at all — and it is the one that survives being opened in a different
     * browser from the one that asked for the reset, since it carries the
     * whole session rather than half of a PKCE pair.
     */
    async function resolveSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;

      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      if (!hash) return false;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return false;

      const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setErr) return false;

      // Drop the tokens from the address bar so they are not left in history
      // or leaked by a copied URL.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return true;
    }

    resolveSession().then((ok) => {
      setHasSession(ok);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("login.err.weakPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("login.err.passwordMismatch"));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || t("login.err.resetFailed"));
      setSaving(false);
      return;
    }
    // Sign out deliberately. The recovery session was granted by an emailed
    // link, not by someone proving they know the password — so make them use
    // the new one. It also invalidates the link for anyone else who saw it.
    await supabase.auth.signOut();
    router.push(`/login?role=${role}&notice=passwordUpdated`);
    router.refresh();
  }

  return (
    <AuthShell role={role === "rider" ? "rider" : role === "admin" ? "admin" : "customer"} headline={t("login.resetTitle")} sub={t("login.resetTagline")}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <h2 className="mb-6 font-display text-3xl font-light tracking-[-0.03em]">{t("login.resetTitle")}</h2>

        {checking ? (
          <p className="py-6 text-center text-xs text-text-dim">{t("login.redirecting")}</p>
        ) : !hasSession ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-xl">⏳</div>
            <p className="mb-5 text-xs leading-relaxed text-text-dim">{t("login.err.resetLinkDead")}</p>
            <Link
              href={`/login?role=${role}`}
              className="block w-full rounded-lg border border-brand/40 py-2.5 text-sm font-semibold text-brand"
            >
              {t("login.backToSignIn")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-display text-base font-semibold">{t("login.resetTitle")}</h2>
            <PasswordField label={t("login.newPassword")} value={password} onChange={setPassword} />
            <PasswordField label={t("login.confirmPassword")} value={confirm} onChange={setConfirm} />
            <p className="text-[11px] text-text-dim">{t("login.passwordHint")}</p>
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t("login.updating") : t("login.updatePassword")}
            </motion.button>
          </form>
        )}
      </motion.div>
    </AuthShell>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useLanguage();
  const [reveal, setReveal] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-dim">{label}</label>
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full rounded-lg border border-border/50 bg-surface-raised px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-brand"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? t("login.hidePassword") : t("login.showPassword")}
          title={reveal ? t("login.hidePassword") : t("login.showPassword")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-dim transition-colors hover:text-text"
        >
          {reveal ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
