"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function ShopLoginPage() {
  return (
    <Suspense fallback={null}>
      <ShopLoginForm />
    </Suspense>
  );
}

function ShopLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=customer` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    router.push(`/shop/verify?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-amber/20 blur-[120px]" />
        <div className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-cyan/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/40"
      >
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber text-bg font-display font-bold">
            D
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold leading-none">Dispatch</h1>
            <p className="text-xs text-text-dim">Order from nearby stores</p>
          </div>
        </div>

        <h2 className="mb-1 font-display text-xl font-semibold">Get your groceries delivered</h2>
        <p className="mb-6 text-sm text-text-dim">Sign in to start shopping.</p>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 text-sm font-semibold text-neutral-800 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </motion.button>

        <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-wide text-text-dim">
          <div className="h-px flex-grow bg-border" />
          or with email
          <div className="h-px flex-grow bg-border" />
        </div>

        <form onSubmit={handleEmailContinue} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-amber"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Sending code…" : "Continue with email"}
          </motion.button>
        </form>

        <p className="mt-5 text-center text-xs text-text-dim">
          We&apos;ll email you a 6-digit code — no password needed.
        </p>
        <p className="mt-4 text-center text-xs text-text-dim">
          Delivering something?{" "}
          <Link href="/rider/login" className="text-cyan hover:underline">
            Rider sign in
          </Link>
        </p>
        <p className="mt-1 text-center text-xs text-text-dim">
          Dispatcher?{" "}
          <Link href="/login" className="text-amber hover:underline">
            Admin login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
