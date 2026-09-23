/**
 * The Dispatch mark: a violet disc carrying a two-stop route that ends in a
 * lime pin. Used everywhere the old "D" tile was, so every screen introduces
 * itself the same way.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-white shadow-[0_10px_24px_-10px] shadow-brand ${className}`}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
      <svg viewBox="0 0 24 24" className="relative h-[58%] w-[58%]" fill="none">
        <path d="M5 17c3 0 3-7 7-7s4-4 7-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 3.4" />
        <circle cx="5" cy="17" r="2.2" fill="currentColor" />
        <circle cx="19" cy="6" r="2.8" fill="var(--lime)" />
      </svg>
    </span>
  );
}

export function Logo({
  className = "",
  markClassName = "h-9 w-9",
  light = false,
}: {
  className?: string;
  markClassName?: string;
  /** White wordmark, for use on a photograph or an ink sheet. */
  light?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span className={`font-display text-lg font-medium tracking-[-0.03em] ${light ? "text-white" : "text-text"}`}>
        dispatch
      </span>
    </span>
  );
}
