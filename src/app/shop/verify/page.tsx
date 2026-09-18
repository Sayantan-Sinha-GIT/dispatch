"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function ShopVerifyPage() {
  return (
    <Suspense fallback={null}>
      <ShopVerifyForm />
    </Suspense>
  );
}

function ShopVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "customer" }),
    });
    const json = await res.json();
    if (!res.ok) {
      await supabase.auth.signOut();
      setError(json.error ?? "Could not sign in");
      setLoading(false);
      return;
    }

    router.push("/shop");
    router.refresh();
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
        <h1 className="mb-1 font-display text-lg font-semibold">Check your email</h1>
        <p className="mb-6 text-sm text-text-dim">
          Enter the 6-digit code we sent to <span className="text-text">{email}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-3 text-center text-2xl tracking-[0.5em] outline-none transition-colors focus:border-amber"
            placeholder="——————"
          />

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full rounded-lg bg-amber py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & continue"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
