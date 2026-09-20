"use client";

import Image from "next/image";

/**
 * The backdrop every screen sits on.
 *
 * Several pages — the cart, the order tracker, an empty order list — were a
 * flat fill with a card floating in the middle of nothing. That reads as
 * unfinished rather than as minimal, and it was the single most common
 * complaint about the design.
 *
 * So depth is built once, here, and every screen gets it:
 *
 *   tone     a large, soft colour wash anchored to one corner. Costs nothing
 *            and stops the page reading as a single flat rectangle.
 *   grid     a faint engineering grid, fading out as it descends. This is a
 *            logistics product; the grid is on-theme rather than decorative.
 *   image    an optional photograph, held far back at low opacity.
 *   grain    the SVG film grain, which is what keeps dark panels from looking
 *            like plastic.
 *
 * Fixed rather than absolute: the backdrop stays put while content scrolls
 * over it, so a long page does not drag a giant gradient along with it.
 */
export function PageBackground({
  accent = "amber",
  image,
  imageOpacity = 0.14,
  grid = true,
}: {
  accent?: "amber" | "cyan" | "both";
  image?: string;
  imageOpacity?: number;
  grid?: boolean;
}) {
  const showAmber = accent === "amber" || accent === "both";
  const showCyan = accent === "cyan" || accent === "both";

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-bg" />

      {image && (
        <>
          <Image src={image} alt="" fill sizes="100vw" className="object-cover" style={{ opacity: imageOpacity }} />
          {/* Keeps the photograph from fighting the content above it. */}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/85 to-bg" />
        </>
      )}

      {showAmber && (
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-amber/[0.07] blur-[120px]" />
      )}
      {showCyan && (
        <div className="absolute -bottom-52 -right-40 h-[32rem] w-[32rem] rounded-full bg-cyan/[0.06] blur-[120px]" />
      )}

      {grid && (
        <svg className="absolute inset-0 h-full w-full text-text opacity-[0.045]">
          <defs>
            <pattern id="page-grid" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
            {/* Fades the grid out downward so it frames the top of the page
                instead of tiling flatly over the whole thing. */}
            <linearGradient id="page-grid-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.9" />
              <stop offset="55%" stopColor="white" stopOpacity="0.25" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="page-grid-mask">
              <rect width="100%" height="100%" fill="url(#page-grid-fade)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="url(#page-grid)" mask="url(#page-grid-mask)" />
        </svg>
      )}

      <div className="grain absolute inset-0" />
    </div>
  );
}
