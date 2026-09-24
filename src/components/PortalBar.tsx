"use client";

import Link from "next/link";
import { Logo, LogoMark } from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The floating glass bar at the top of every signed-in screen: the same pill
 * as the landing page's navigation once it has scrolled, so moving from the
 * site into a portal feels like one product. `back` swaps the logo for a
 * round back button and a title, for pages one level down.
 */
export function PortalBar({
  back,
  title,
  wide = false,
  children,
}: {
  back?: string;
  /** Match the console's wider page. */
  wide?: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <header className="sticky top-[var(--safe-top)] z-30 px-2.5 pt-2.5 sm:px-4 sm:pt-4">
      <div className={`glass mx-auto flex ${wide ? "max-w-[1600px]" : "max-w-[1400px]"} items-center justify-between gap-3 rounded-full p-1.5 shadow-[0_18px_40px_-26px_rgba(40,24,110,0.5)] ring-1 ring-border/70`}>
        <div className="flex min-w-0 items-center gap-2.5">
          {back ? (
            <Link
              href={back}
              aria-label={t("common.back")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text ring-1 ring-border transition-colors hover:bg-brand hover:text-white hover:ring-brand"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M13 8H3M7 4 3 8l4 4" />
              </svg>
            </Link>
          ) : (
            <Link href="/" aria-label="Dispatch" className="shrink-0">
              <span className="sm:hidden">
                <LogoMark className="h-9 w-9" />
              </span>
              <span className="hidden pr-1 sm:block">
                <Logo />
              </span>
            </Link>
          )}
          {title && <p className="truncate font-display text-base font-medium tracking-tight">{title}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      </div>
    </header>
  );
}

/** A secondary pill for the bar's right side. */
export const barPill =
  "rounded-full bg-surface px-3.5 py-2 text-sm text-text-dim ring-1 ring-border transition-colors hover:text-text";
