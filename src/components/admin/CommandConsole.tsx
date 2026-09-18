"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

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
      className="rounded-2xl border border-border bg-surface p-4"
    >
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
        <span>✨</span> {t("admin.console.title")}
      </h2>
      <p className="mt-1 text-xs text-text-dim">{t("admin.console.subtitle")}</p>

      <form onSubmit={run} className="mt-3">
        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(e as unknown as React.FormEvent);
          }}
          placeholder={t("admin.console.placeholder")}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber"
        />
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={running || !command.trim()}
          className="mt-2 w-full rounded-xl bg-amber py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {running ? t("admin.console.running") : t("admin.console.run")}
        </motion.button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-text-dim">
          {t("admin.console.examplesTitle")}
        </span>
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => setCommand(ex)}
            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-dim transition-colors hover:border-amber/50 hover:text-amber"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      )}

      {reply && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-dim"
        >
          {reply}
        </motion.p>
      )}

      {/* Destructive actions wait for an explicit confirm */}
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.div
            key="pending-confirm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
              <p className="text-xs font-semibold text-danger">{t("admin.console.confirmTitle")}</p>
              <p className="mt-0.5 text-[11px] text-text-dim">{t("admin.console.confirmNote")}</p>
              <ul className="mt-2 space-y-1">
                {pending.map((p, i) => (
                  <li key={i} className="rounded-lg bg-surface-raised px-2.5 py-1.5 text-xs">
                    {p.label}
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={apply}
                  disabled={applying}
                  className="flex-1 rounded-lg bg-danger py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {applying ? t("admin.console.applying") : t("admin.console.apply")}
                </motion.button>
                <button
                  onClick={() => setPending([])}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-text-dim"
                >
                  {t("admin.console.discard")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {results.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {results.map((r, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-lg px-2.5 py-1.5 text-xs ${
                r.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              }`}
            >
              <span className="font-medium">{r.ok ? "✓" : "✕"} {r.label}</span>
              {r.message && <span className="block text-text-dim">{r.message}</span>}
            </motion.li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber/10 px-2.5 py-1.5 text-[11px] text-amber">
          {t("admin.console.rejected")}: {rejected.join("; ")}
        </div>
      )}
    </motion.section>
  );
}
