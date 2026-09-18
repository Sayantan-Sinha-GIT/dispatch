"use client";

import { motion } from "framer-motion";

/** Fixed, full-page animated backdrop reused across dashboards and tracking screens. */
export function AmbientBackground({ accent }: { accent: "amber" | "cyan" | "success" }) {
  const color = accent === "success" ? "rgba(61,220,151,0.16)" : accent === "cyan" ? "rgba(45,212,196,0.14)" : "rgba(255,176,32,0.16)";
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.04]" aria-hidden>
        <defs>
          <pattern id="ambient-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M 44 0 L 0 0 0 44" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-grid)" />
      </svg>
      <motion.div
        className="absolute -left-40 top-0 h-96 w-96 rounded-full blur-[110px]"
        style={{ background: color }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan/10 blur-[110px]"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
