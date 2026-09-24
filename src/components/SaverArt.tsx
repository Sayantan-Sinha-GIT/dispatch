/**
 * What a photograph becomes in Data Saver: the same panel, drawn in colour
 * and a route line instead of pixels, so the page keeps its shape and its
 * feel without downloading a picture. Weighs nothing - it is all CSS and an
 * inline SVG.
 *
 * Each variant carries the mood of the photo it replaces: violet for
 * shopping, night-and-lime for riders, deep indigo for the console, and a
 * brighter mix for the landing page.
 */
export type SaverArtVariant = "hero" | "customer" | "rider" | "admin" | "city";

const BACKGROUNDS: Record<SaverArtVariant, string> = {
  hero: "radial-gradient(90% 70% at 20% 10%, #8b6cff 0%, transparent 60%), radial-gradient(70% 60% at 85% 90%, rgba(200,243,74,0.35) 0%, transparent 60%), linear-gradient(160deg, #2a1d6b 0%, #120c2e 100%)",
  customer: "radial-gradient(80% 70% at 25% 15%, #9d85ff 0%, transparent 60%), linear-gradient(160deg, #5a3fe0 0%, #241563 100%)",
  rider: "radial-gradient(70% 60% at 80% 85%, rgba(200,243,74,0.45) 0%, transparent 60%), linear-gradient(165deg, #1d1840 0%, #0b0918 100%)",
  admin: "radial-gradient(80% 70% at 75% 20%, #6d7dff 0%, transparent 60%), linear-gradient(160deg, #26207a 0%, #0f0c2b 100%)",
  city: "radial-gradient(80% 60% at 50% 100%, rgba(139,108,255,0.55) 0%, transparent 65%), linear-gradient(180deg, #15112f 0%, #0c0a1c 100%)",
};

export function SaverArt({ variant, className = "" }: { variant: SaverArtVariant; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ background: BACKGROUNDS[variant] }}>
      {/* The brand's dotted route, drawn big and faint across the panel. */}
      <svg className="absolute -right-[6%] bottom-[4%] h-[42%] max-h-[22rem] w-auto opacity-[0.2]" viewBox="0 0 24 24" fill="none">
        <path d="M5 17c3 0 3-7 7-7s4-4 7-4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="0.1 2.2" />
        <circle cx="5" cy="17" r="1.4" fill="#fff" />
        <circle cx="19" cy="6" r="1.9" fill="#c8f34a" />
      </svg>
      <svg className="absolute -left-[8%] top-[6%] h-[24%] max-h-[12rem] w-auto rotate-12 opacity-[0.1]" viewBox="0 0 24 24" fill="none">
        <path d="M5 17c3 0 3-7 7-7s4-4 7-4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="0.1 2.2" />
        <circle cx="19" cy="6" r="1.9" fill="#fff" />
      </svg>
    </div>
  );
}
