"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Activates a new account with an emailed code.
 *
 * Signup used to send a link. Mail providers follow links before the recipient
 * does — Gmail spent one of ours 46 seconds after it was sent — and a token
 * that has already been used reads to the person as "expired". A typed code
 * cannot be consumed by something that only follows links.
 *
 * Shared by the customer card and the rider signup page so the two cannot
 * drift apart.
 */
export function VerifyCodeForm({
  email,
  code,
  onCode,
  onSubmit,
  onResend,
  onBack,
  loading,
  resendState,
  error,
  accent,
}: {
  email: string;
  code: string;
  onCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onBack: () => void;
  loading: boolean;
  resendState: "idle" | "sending" | "sent";
  error: string | null;
  accent: "amber" | "cyan";
}) {
  const { t } = useLanguage();
  const accentText = accent === "amber" ? "text-amber" : "text-cyan";
  const accentBg = accent === "amber" ? "bg-amber" : "bg-cyan";
  const accentFocus = accent === "amber" ? "focus:border-amber" : "focus:border-cyan";

  return (
    <div>
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl ${
          accent === "amber" ? "bg-amber/15" : "bg-cyan/15"
        }`}
      >
        ✉️
      </div>
      <h2 className="mb-2 text-center font-display text-base font-semibold">{t("login.verifyCodeTitle")}</h2>
      <p className="mb-4 text-center text-xs leading-relaxed text-text-dim">
        {t("login.verifyCodeIntro", { email })}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-dim">
            {t("login.verifyCode")}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => onCode(e.target.value)}
            required
            // Lets phones offer the code straight from the notification.
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder={t("login.ph.resetCode")}
            className={`w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none transition-colors ${accentFocus}`}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className={`w-full rounded-lg py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 ${accentBg}`}
        >
          {loading ? t("login.verifying") : t("login.verifyCodeSubmit")}
        </motion.button>
      </form>

      <p className="mt-3 text-center text-[11px] text-text-dim">{t("login.codeSpamHint")}</p>
      <button
        type="button"
        onClick={onResend}
        disabled={resendState !== "idle"}
        className={`mt-2 w-full text-center text-xs hover:underline disabled:opacity-60 ${accentText}`}
      >
        {resendState === "sending"
          ? t("login.resending")
          : resendState === "sent"
            ? t("login.resent")
            : t("login.resendCode")}
      </button>
      <button type="button" onClick={onBack} className="mt-2 w-full text-center text-xs text-text-dim hover:text-text">
        {t("login.backToSignIn")}
      </button>
    </div>
  );
}
