"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { SparkIcon } from "./icons";

interface ActionResult {
  label: string;
  ok: boolean;
  message: string;
}
interface PendingAction {
  action: Record<string, unknown>;
  label: string;
}

/**
 * Natural-language admin console. Non-destructive instructions run straight
 * away; anything that cancels, deletes or suspends comes back as a plan the
 * admin has to confirm, so an LLM misread can't quietly destroy data.
 */
export function CommandConsole({ onChanged }: { onChanged: () => void }) {
  const { t } = useLanguage();
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [results, setResults] = useState<ActionResult[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim() || busyRef.current) return;
    busyRef.current = true;
    setRunning(true);
    setError(null);
    setResults([]);
    setPending([]);
    setRejected([]);
    setReply(null);

    try {
      const res = await fetch("/api/admin/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);

      setReply(json.reply ?? null);
      setResults(json.results ?? []);
      setPending(json.pending ?? []);
      setRejected(json.rejected ?? []);
      if ((json.results ?? []).length > 0) onChanged();
      if ((json.pending ?? []).length === 0) setCommand("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.err.generic"));
    } finally {
      setRunning(false);
      busyRef.current = false;
    }
  }

  async function apply() {
    if (pending.length === 0 || busyRef.current) return;
    busyRef.current = true;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, actions: pending.map((p) => p.action) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.code ? t(`api.err.${json.code}`) : json.error);
      setResults((prev) => [...prev, ...(json.results ?? [])]);
      setPending([]);
      setCommand("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.err.generic"));
    } finally {
      setApplying(false);
      busyRef.current = false;
    }
  }

  const examples = [t("admin.console.ex1"), t("admin.console.ex2"), t("admin.console.ex3")];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-[1px]"
    >
      {/* A slow-moving gradient edge marks this as the console's primary control. */}
      <motion.span
        aria-hidden
        className="absolute inset-[-40%] bg-[conic-gradient(from_0deg,transparent_0deg,var(--amber)_60deg,transparent_120deg,var(--cyan)_220deg,transparent_280deg)] opacity-60"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />
      <div className="surface-raised-soft relative rounded-[15px] bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber/15 text-amber">
            <SparkIcon className="h-4 w-4" />
          </span>
          <h2 className="font-display text-sm font-semibold">{t("admin.console.title")}</h2>
          <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-dim">
            Gemini
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-dim">{t("admin.console.subtitle")}</p>

        <form onSubmit={run} className="mt-4">
          <div className="relative rounded-xl bg-bg/60 ring-1 ring-border/80 transition-shadow focus-within:shadow-[0_0_0_4px] focus-within:shadow-amber/10 focus-within:ring-amber/70">
            <span className="pointer-events-none absolute left-3 top-2.5 font-mono text-sm text-amber">›</span>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(e as unknown as React.FormEvent);
              }}
              placeholder={t("admin.console.placeholder")}
              rows={3}
              className="w-full resize-none bg-transparent py-2.5 pl-7 pr-3 font-mono text-[13px] leading-relaxed outline-none placeholder:font-sans placeholder:text-text-dim/80"
            />
            <div className="flex items-center justify-end gap-2 border-t sm:justify-between border-border/60 px-3 py-2">
              <span className="hidden text-[10px] text-text-dim sm:inline">{t("admin.console.hint")}</span>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={running || !command.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-amber px-3.5 py-1.5 text-xs font-bold text-bg shadow-[0_6px_20px_-8px] shadow-amber transition-opacity disabled:opacity-40 disabled:shadow-none"
              >
                {running && <span className="h-3 w-3 animate-spin rounded-full border-2 border-bg border-t-transparent" />}
                {running ? t("admin.console.running") : t("admin.console.run")}
              </motion.button>
            </div>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">
            {t("admin.console.examplesTitle")}
          </span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setCommand(ex)}
              className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-text-dim ring-1 ring-border/70 transition-colors hover:text-amber hover:ring-amber/50"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        {reply && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex gap-2 rounded-xl bg-surface-raised px-3 py-2.5 text-xs leading-relaxed"
          >
            <span className="mt-0.5 text-amber">
              <SparkIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-text">{reply}</span>
          </motion.div>
        )}

        {/* Destructive actions wait for an explicit confirm. No exit animation:
            the Apply button must never be left mid-transition at zero height. */}
        {pending.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl border border-danger/40 bg-danger/[0.06] p-3.5"
          >
            <p className="text-xs font-semibold text-danger">{t("admin.console.confirmTitle")}</p>
            <p className="mt-0.5 text-[11px] text-text-dim">{t("admin.console.confirmNote")}</p>
            <ul className="mt-2.5 space-y-1">
              {pending.map((p, i) => (
                <li key={i} className="flex gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs ring-1 ring-border/60">
                  <span className="font-mono text-danger">{i + 1}.</span>
                  {p.label}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={apply}
                disabled={applying}
                className="flex-1 rounded-lg bg-danger py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {applying ? t("admin.console.applying") : t("admin.console.apply")}
              </motion.button>
              <button
                onClick={() => setPending([])}
                className="rounded-lg border border-border px-3 py-2 text-xs text-text-dim transition-colors hover:text-text"
              >
                {t("admin.console.discard")}
              </button>
            </div>
          </motion.div>
        )}

        {results.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {results.map((r, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-lg px-3 py-2 text-xs ${r.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
              >
                <span className="font-semibold">
                  {r.ok ? "✓" : "✕"} {r.label}
                </span>
                {/* A question's answer is already shown as the reply above. */}
                {r.message && r.message !== reply && <span className="mt-0.5 block text-text-dim">{r.message}</span>}
              </motion.li>
            ))}
          </ul>
        )}

        {rejected.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber/10 px-3 py-2 text-[11px] text-amber">
            {t("admin.console.rejected")}: {rejected.join("; ")}
          </div>
        )}
      </div>
    </motion.section>
  );
}
