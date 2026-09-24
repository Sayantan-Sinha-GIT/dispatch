import { PortalBar } from "@/components/PortalBar";
import { AmbientBackground } from "@/components/AmbientBackground";

export type LegalSection = { heading: string; body: React.ReactNode };

/**
 * Privacy policy and terms: one readable column on a white sheet. English
 * only, like most legal text, and marked so the Hindi translation check does
 * not count it as untranslated.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="relative min-h-screen pb-10">
      <AmbientBackground accent="brand" />
      <PortalBar back="/" title={title} />
      <main
        data-no-i18n
        lang="en"
        className="sheet relative mx-2.5 mt-3 px-6 py-9 sm:mx-auto sm:mt-4 sm:max-w-3xl sm:px-12 sm:py-12"
      >
        <h1 className="font-display text-4xl font-light tracking-[-0.04em] sm:text-5xl">{title}</h1>
        <p className="mt-2 text-xs text-text-dim">Last updated {updated}</p>
        <p className="mt-6 text-[15px] leading-relaxed text-text-dim">{intro}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-xl font-medium tracking-[-0.02em]">{s.heading}</h2>
              <div className="mt-2.5 space-y-2.5 text-[15px] leading-relaxed text-text-dim [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-text [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
