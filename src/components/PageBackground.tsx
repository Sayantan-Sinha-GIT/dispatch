"use client";

import Image from "next/image";

type Tint = "brand" | "zest" | "both" | "success";

/**
 * The backdrop every screen sits on: a pale lavender field in the light theme,
 * a violet night in the dark one.
 *
 * The reference designs float their content as white sheets over a soft,
 * blurred landscape. A photograph behind every page would be heavy and slow,
 * so the landscape is built from colour alone: a few very large blurred
 * fields that drift slowly. `tint` shifts the balance per portal (violet for
 * the shop and console, lime-leaning for riders) without changing the system.
 *
 * `image` is an optional photograph, held far back and blurred, for pages
 * that want a hint of place. Fixed rather than absolute, so long pages scroll
 * over it instead of dragging it along.
 */
export function PageBackground({
  accent = "brand",
  image,
  imageOpacity = 0.14,
}: {
  accent?: Tint;
  image?: string;
  imageOpacity?: number;
  /** Kept for callers from the previous design; the grid is gone. */
  grid?: boolean;
}) {
  return <Field tint={accent} image={image} imageOpacity={imageOpacity} />;
}

export function Field({
  tint = "brand",
  image,
  imageOpacity = 0.14,
  fixed = true,
}: {
  tint?: Tint;
  image?: string;
  imageOpacity?: number;
  fixed?: boolean;
}) {
  const second =
    tint === "zest" ? "bg-lime/25 dark:bg-lime/10" : tint === "success" ? "bg-success/20 dark:bg-success/10" : "bg-[#9ec1ff]/45 dark:bg-[#5b7cff]/15";

  return (
    <div className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 -z-10 overflow-hidden`} aria-hidden>
      <div className="absolute inset-0 bg-bg" />

      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="100vw"
          className="scale-110 object-cover blur-2xl saturate-50"
          style={{ opacity: imageOpacity }}
        />
      )}

      <div className="field-blob -left-[12%] -top-[18%] h-[62vmax] w-[62vmax] bg-brand/25 dark:bg-brand/15" />
      <div
        className={`field-blob -right-[18%] top-[18%] h-[52vmax] w-[52vmax] ${second}`}
        style={{ animationDelay: "-7s", animationDuration: "26s" }}
      />
      {tint === "both" && (
        <div
          className="field-blob -bottom-[25%] left-[20%] h-[40vmax] w-[40vmax] bg-lime/20 dark:bg-lime/[0.07]"
          style={{ animationDelay: "-13s", animationDuration: "30s" }}
        />
      )}
      {/* Lifts the centre so white sheets sit on light, not on colour. */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,var(--bg)_0%,transparent_100%)] opacity-70" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
