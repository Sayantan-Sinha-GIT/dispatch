"use client";

import { motion } from "framer-motion";
import { Field } from "./PageBackground";

/**
 * Sign-in, sign-up and onboarding: the lavender field, with one route drawn
 * across it and a courier dot travelling along it, so the first screen still
 * says "delivery".
 */
export function AuthBackground({ accent = "brand" }: { accent?: "brand" | "zest" }) {
  const stroke = accent === "brand" ? "var(--brand)" : "var(--zest)";
  const path = "M -50 650 C 150 550, 250 700, 400 550 S 650 350, 850 400";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Field tint={accent === "brand" ? "both" : "zest"} fixed={false} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden>
        <motion.path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeDasharray="6 10"
          strokeOpacity="0.35"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <motion.circle
          r="6"
          // Positioned by offsetPath, but SVG still needs a declared origin —
          // otherwise cx/cy are written as "undefined" on every frame.
          cx={0}
          cy={0}
          fill="var(--lime)"
          stroke={stroke}
          strokeWidth="2"
          initial={{ cx: 0, cy: 0, offsetDistance: "0%" }}
          animate={{ cx: 0, cy: 0, offsetDistance: ["0%", "100%"] }}
          style={{ offsetPath: `path('${path}')` }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  );
}
