"use client";

import { motion } from "framer-motion";

/** Shared animated backdrop for every auth-adjacent screen (login, signup, onboarding). */
export function AuthBackground({ accent = "amber" }: { accent?: "amber" | "cyan" }) {
  const primary = accent === "amber" ? "bg-amber" : "bg-cyan";
  const secondary = accent === "amber" ? "bg-cyan" : "bg-amber";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M 42 0 L 0 0 0 42" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <motion.div
        className={`absolute -left-32 top-1/4 h-96 w-96 rounded-full ${primary}/20 blur-[120px]`}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`absolute -right-24 bottom-1/4 h-96 w-96 rounded-full ${secondary}/10 blur-[120px]`}
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden>
        <motion.path
          d="M -50 650 C 150 550, 250 700, 400 550 S 650 350, 850 400"
          fill="none"
          stroke={accent === "amber" ? "#ffb020" : "#2dd4c4"}
          strokeWidth="2"
          strokeDasharray="6 10"
          strokeOpacity="0.25"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <motion.circle
          r="5"
          // Positioned by offsetPath, but SVG still needs a declared origin —
          // otherwise cx/cy are written as "undefined" on every frame.
          cx={0}
          cy={0}
          fill={accent === "amber" ? "#ffb020" : "#2dd4c4"}
          initial={{ cx: 0, cy: 0, offsetDistance: "0%" }}
          animate={{
            cx: 0,
            cy: 0,
            offsetDistance: ["0%", "100%"],
          }}
          style={{ offsetPath: "path('M -50 650 C 150 550, 250 700, 400 550 S 650 350, 850 400')" }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  );
}
