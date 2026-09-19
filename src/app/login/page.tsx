"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AuthBackground } from "@/components/AuthBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";

type Role = "customer" | "rider" | "admin";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <UnifiedLogin />
    </Suspense>
  );
}

/** Supabase phrases this a few different ways; all of them mean "click the link first". */
function isUnconfirmedEmail(message: string | undefined) {
  return !!message && /not confirmed|not verified|confirm your email/i.test(message);
}

function UnifiedLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const initialRole = (searchParams.get("role") as Role) ?? "customer";
  const [role, setRole] = useState<Role>(["customer", "rider", "admin"].includes(initialRole) ? initialRole : "customer");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  /**
   * Two modes only. Accounts are created with a password and activated by
   * clicking the link Supabase emails; there is no code to type anywhere.
   */
  const [customerMode, setCustomerMode] = useState<"signin" | "signup" | "sent">("signin");
  const errCode = searchParams.get("err");
  const [error, setError] = useState<string | null>(errCode ? t(`login.err.${errCode}`) : searchParams.get("error"));
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("notice") === "verified" ? t("login.verifiedNotice") : null,
  );
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const ROLE_META: Record<Role, { label: string; tagline: string; accent: "amber" | "cyan" }> = {
    customer: { label: t("login.tab.customer"), tagline: t("login.tagline.customer"), accent: "amber" },
    rider: { label: t("login.tab.rider"), tagline: t("login.tagline.rider"), accent: "cyan" },
    admin: { label: t("login.tab.admin"), tagline: t("login.tagline.admin"), accent: "amber" },
  };

  const meta = ROLE_META[role];

  function resetFeedback() {
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    setResendState("idle");
  }

  function switchRole(next: Role) {
    setRole(next);
    resetFeedback();
    setPassword("");
    setCustomerMode("signin");
  }

  /** Shared by all three roles: sign in, then refuse if the profile is a different role. */
  async function passwordSignIn(expected: Role, destination: string) {
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      if (isUnconfirmedEmail(signInError?.message)) {
        setError(t("login.err.emailNotConfirmed"));
        setNeedsVerification(true);
      } else {
        setError(signInError?.message ?? t("login.err.signInFailed"));
      }
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const actual = profile?.role ?? null;
    // A customer profile may legitimately not be stamped yet (first Google
    // sign-in); riders and admins must already carry their role.
    const mismatch = expected === "customer" ? !!actual && actual !== "customer" : actual !== expected;
    if (mismatch) {
      await supabase.auth.signOut();
      setError(
        expected === "customer"
          ? t("login.err.notCustomer")
          : expected === "rider"
            ? t("login.err.notRider")
            : t("login.err.notAdmin"),
      );
      setLoading(false);
      return;
    }
    router.push(destination);
    router.refresh();
  }

  function handleSignIn(expected: Role, destination: string) {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      resetFeedback();
      setLoading(true);
      await passwordSignIn(expected, destination);
    };
  }

  async function handleCustomerSignUp(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    if (password.length < 8) {
      setError(t("login.err.weakPassword"));
      return;
    }
    setLoading(true);
    const supabase = createClient();
    // Sign up from the browser (not through an admin API call) precisely so
    // Supabase sends the confirmation email. The account stays inactive until
    // the link in that email is clicked.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), role: "customer" },
        emailRedirectTo: `${window.location.origin}/auth/callback?intent=customer`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // Supabase hides "this email is taken" behind a user object with no
    // identities rather than an error, so as not to leak who has an account.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError(t("login.err.emailTaken"));
      return;
    }
    // If the project has email confirmation switched off, signUp returns a live
    // session — there is nothing to verify, so go straight in.
    if (data.session) {
      await fetch("/api/auth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "customer" }),
      });
      router.push("/shop");
      router.refresh();
      return;
    }
    setCustomerMode("sent");
  }

  async function handleResend() {
    if (!email) return;
    setResendState("sending");
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?intent=${role}` },
    });
    setResendState("sent");
  }

  async function handleGoogle() {
    resetFeedback();
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=${role}` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthBackground accent={meta.accent} />

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface/90 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg font-display font-bold text-bg ${
              meta.accent === "amber" ? "bg-amber" : "bg-cyan"
            }`}
          >
            D
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold leading-none">Dispatch</h1>
            <p className="text-xs text-text-dim">{meta.tagline}</p>
          </div>
        </Link>

        <div className="mb-6 grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-surface-raised p-1">
          {(["customer", "rider", "admin"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => switchRole(r)}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                role === r ? (r === "admin" || r === "customer" ? "bg-amber text-bg" : "bg-cyan text-bg") : "text-text-dim hover:text-text"
              }`}
            >
              {ROLE_META[r].label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${role}-${customerMode}`}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
          >
            {role === "customer" && customerMode === "sent" && (
              <VerifySent
                email={email}
                accent="amber"
                onBack={() => {
                  setCustomerMode("signin");
                  resetFeedback();
                }}
                onResend={handleResend}
                resendState={resendState}
              />
            )}

            {role === "customer" && customerMode === "signin" && (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 text-sm font-semibold text-neutral-800 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <GoogleIcon />
                  {googleLoading ? t("login.redirecting") : t("login.google")}
                </motion.button>
                <Divider label={t("login.orEmail")} />
                <form onSubmit={handleSignIn("customer", "/shop")} className="space-y-4">
                  <FormField label={t("login.email")} type="email" value={email} onChange={setEmail} placeholder={t("login.ph.email")} accent="amber" />
                  <FormField label={t("login.password")} type="password" value={password} onChange={setPassword} placeholder="••••••••" accent="amber" />
                  <ErrorNotice error={error} />
                  {notice && <SuccessNotice message={notice} />}
                  <ResendRow show={needsVerification} state={resendState} onResend={handleResend} accent="amber" />
                  <SubmitButton loading={loading} accent="amber" label={t("login.signIn")} loadingLabel={t("login.signingIn")} />
                </form>
                <p className="mt-4 text-center text-xs text-text-dim">
                  {t("login.newHere")}{" "}
                  <button type="button" onClick={() => { setCustomerMode("signup"); resetFeedback(); }} className="text-amber hover:underline">
                    {t("login.createAccount")}
                  </button>
                </p>
              </>
            )}

            {role === "customer" && customerMode === "signup" && (
              <>
                <form onSubmit={handleCustomerSignUp} className="space-y-4">
                  <FormField label={t("login.name")} type="text" value={name} onChange={setName} placeholder={t("login.ph.name")} accent="amber" />
                  <FormField label={t("login.email")} type="email" value={email} onChange={setEmail} placeholder={t("login.ph.email")} accent="amber" />
                  <FormField label={t("login.password")} type="password" value={password} onChange={setPassword} placeholder="••••••••" accent="amber" />
                  <p className="text-[11px] text-text-dim">{t("login.passwordHint")}</p>
                  <p className="text-[11px] text-text-dim">{t("login.verifyNotice")}</p>
                  <ErrorNotice error={error} />
                  <SubmitButton loading={loading} accent="amber" label={t("login.createAccount")} loadingLabel={t("login.creating")} />
                </form>
                <p className="mt-4 text-center text-xs text-text-dim">
                  {t("login.haveAccount")}{" "}
                  <button type="button" onClick={() => { setCustomerMode("signin"); resetFeedback(); }} className="text-amber hover:underline">
                    {t("login.signIn")}
                  </button>
                </p>
              </>
            )}

            {role === "rider" && (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 text-sm font-semibold text-neutral-800 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <GoogleIcon />
                  {googleLoading ? t("login.redirecting") : t("login.google")}
                </motion.button>
                <Divider label={t("login.orEmail")} />
                <form onSubmit={handleSignIn("rider", "/rider")} className="space-y-4">
                  <FormField label={t("login.email")} type="email" value={email} onChange={setEmail} placeholder={t("login.ph.email")} accent="cyan" />
                  <FormField label={t("login.password")} type="password" value={password} onChange={setPassword} placeholder="••••••••" accent="cyan" />
                  <ErrorNotice error={error} />
                  {notice && <SuccessNotice message={notice} />}
                  <ResendRow show={needsVerification} state={resendState} onResend={handleResend} accent="cyan" />
                  <SubmitButton loading={loading} accent="cyan" label={t("login.signIn")} loadingLabel={t("login.signingIn")} />
                </form>
                <p className="mt-4 text-center text-xs text-text-dim">
                  {t("login.newRider")}{" "}
                  <Link href="/rider/signup" className="text-cyan hover:underline">
                    {t("login.signUp")}
                  </Link>
                </p>
              </>
            )}

            {role === "admin" && (
              <form onSubmit={handleSignIn("admin", "/admin")} className="space-y-4">
                <FormField label={t("login.email")} type="email" value={email} onChange={setEmail} placeholder={t("login.ph.adminEmail")} accent="amber" />
                <FormField label={t("login.password")} type="password" value={password} onChange={setPassword} placeholder="••••••••" accent="amber" />
                <ErrorNotice error={error} />
                {notice && <SuccessNotice message={notice} />}
                <SubmitButton loading={loading} accent="amber" label={t("login.signIn")} loadingLabel={t("login.signingIn")} />
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function VerifySent({
  email,
  accent,
  onBack,
  onResend,
  resendState,
}: {
  email: string;
  accent: "amber" | "cyan";
  onBack: () => void;
  onResend: () => void;
  resendState: "idle" | "sending" | "sent";
}) {
  const { t } = useLanguage();
  return (
    <div className="text-center">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl ${
          accent === "amber" ? "bg-amber/15" : "bg-cyan/15"
        }`}
      >
        ✉️
      </div>
      <h2 className="mb-2 font-display text-base font-semibold">{t("login.checkInbox")}</h2>
      <p className="mb-1 text-xs leading-relaxed text-text-dim">{t("login.verifySent", { email })}</p>
      <p className="mb-5 text-[11px] text-text-dim">{t("login.verifySpamHint")}</p>
      <button
        type="button"
        onClick={onResend}
        disabled={resendState !== "idle"}
        className={`w-full rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-60 ${
          accent === "amber" ? "border-amber/40 text-amber" : "border-cyan/40 text-cyan"
        }`}
      >
        {resendState === "sending" ? t("login.resending") : resendState === "sent" ? t("login.resent") : t("login.resend")}
      </button>
      <button type="button" onClick={onBack} className="mt-3 w-full text-center text-xs text-text-dim hover:text-text">
        {t("login.backToSignIn")}
      </button>
    </div>
  );
}

function ResendRow({
  show,
  state,
  onResend,
  accent,
}: {
  show: boolean;
  state: "idle" | "sending" | "sent";
  onResend: () => void;
  accent: "amber" | "cyan";
}) {
  const { t } = useLanguage();
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onResend}
      disabled={state !== "idle"}
      className={`w-full text-center text-xs hover:underline disabled:opacity-60 ${
        accent === "amber" ? "text-amber" : "text-cyan"
      }`}
    >
      {state === "sending" ? t("login.resending") : state === "sent" ? t("login.resent") : t("login.resend")}
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-wide text-text-dim">
      <div className="h-px flex-grow bg-border" />
      {label}
      <div className="h-px flex-grow bg-border" />
    </div>
  );
}

function FormField({
  label,
  type,
  value,
  onChange,
  placeholder,
  accent,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  accent: "amber" | "cyan";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none transition-colors ${
          accent === "amber" ? "focus:border-amber" : "focus:border-cyan"
        }`}
      />
    </div>
  );
}

function ErrorNotice({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {error}
    </motion.p>
  );
}

function SuccessNotice({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
    >
      {message}
    </motion.p>
  );
}

function SubmitButton({
  loading,
  accent,
  label,
  loadingLabel,
  disabled,
}: {
  loading: boolean;
  accent: "amber" | "cyan";
  label: string;
  loadingLabel: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="submit"
      disabled={loading || disabled}
      className={`w-full rounded-lg py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 ${
        accent === "amber" ? "bg-amber" : "bg-cyan"
      }`}
    >
      {loading ? loadingLabel : label}
    </motion.button>
  );
}
