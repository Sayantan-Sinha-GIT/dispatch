"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { StatCounter } from "@/components/StatCounter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";
import { Logo, LogoMark } from "@/components/Brand";
import { PageBackground } from "@/components/PageBackground";

/*
 * The landing page is a stack of sheets floating on the lavender field: a
 * photographic hero, a white "about" sheet with big numbers, a lavender sheet
 * listing the three ways in, an ink sheet explaining the engine, a carousel
 * of features, a photographic call to action and an ink footer. Each sheet is
 * one idea; nothing is a grid of identical boxes.
 */

const NAV_LINKS = [
  { href: "#roles", key: "nav.getStarted" },
  { href: "#how-it-works", key: "nav.howItWorks" },
  { href: "#features", key: "nav.features" },
] as const;

const ROLES = [
  { key: "customer", titleKey: "roles.customer.title", descKey: "roles.customer.desc", ctaKey: "roles.customer.cta", image: "/images/landing/customer.webp" },
  { key: "rider", titleKey: "roles.rider.title", descKey: "roles.rider.desc", ctaKey: "roles.rider.cta", image: "/images/landing/rider.webp" },
  { key: "admin", titleKey: "roles.admin.title", descKey: "roles.admin.desc", ctaKey: "roles.admin.cta", image: "/images/landing/admin.webp" },
] as const;

const STEPS = ["how.step1", "how.step2", "how.step3", "how.step4"];

const FEATURES = ["features.gps", "features.autoAssign", "features.selfHealing", "features.penalty", "features.auth", "features.console"] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

/** Page gutter and width shared by every sheet, so their edges line up. */
const WRAP = "mx-auto w-full max-w-[1400px] px-2.5 sm:px-4";

function Arrow({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/** The primary pill: text plus the lime dot carrying an arrow. */
function DotButton({
  href,
  children,
  tone = "light",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "brand" | "ink";
  className?: string;
}) {
  const skin =
    tone === "brand"
      ? "bg-brand text-white shadow-[0_14px_34px_-14px] shadow-brand"
      : tone === "ink"
        ? "bg-ink text-white"
        : "bg-white text-[#16141f] shadow-[0_14px_34px_-18px_rgba(0,0,0,0.5)]";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-sm font-medium transition-transform hover:-translate-y-0.5 active:scale-[0.97] ${skin} ${className}`}
    >
      <span className="cta-dot transition-transform duration-300 group-hover:rotate-[-45deg]">
        <Arrow />
      </span>
      {children}
    </Link>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-sm ${light ? "text-white/60" : "text-text-dim"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${light ? "bg-lime" : "bg-brand"}`} />
      {children}
    </p>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Nav() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="fixed inset-x-0 top-3 z-50 px-4 sm:top-6 sm:px-8"
    >
      <div
        className={`mx-auto flex max-w-[1340px] items-center justify-between gap-3 rounded-full py-2 pl-2.5 pr-2 transition-all duration-500 ${
          scrolled ? "glass shadow-[0_18px_40px_-24px_rgba(40,24,110,0.45)] ring-1 ring-border/60" : ""
        }`}
      >
        <Link href="/" aria-label="Dispatch">
          <Logo light={!scrolled} markClassName="h-9 w-9" />
        </Link>
        <div
          className={`hidden items-center gap-1 rounded-full p-1 md:flex ${
            scrolled ? "" : "bg-white/10 ring-1 ring-white/15 backdrop-blur-md"
          }`}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                scrolled ? "text-text-dim hover:bg-surface-raised hover:text-text" : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              {t(l.key)}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {t("nav.signIn")}
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

function Hero() {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.14]);
  const sheetScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  return (
    <section ref={ref} className={`${WRAP} pt-2.5 sm:pt-4`}>
      <motion.div
        style={{ scale: sheetScale }}
        className="relative isolate flex min-h-[calc(100svh-1.25rem)] flex-col overflow-hidden rounded-[2rem] bg-ink text-white sm:min-h-[calc(100svh-2rem)] sm:rounded-[2.6rem]"
      >
        <motion.div style={{ y: imageY, scale: imageScale }} className="absolute inset-0 -z-20">
          {/* Two framings rather than one crop: on a phone the wide photo puts
              the rider directly behind the headline. */}
          <picture>
            <source media="(max-width: 700px)" srcSet="/images/landing/hero-mobile.webp" />
            <img src="/images/landing/hero.webp" alt="" fetchPriority="high" className="h-full w-full object-cover" />
          </picture>
        </motion.div>
        {/* The night photograph, turned violet: a colour layer carries the
            palette, and a vertical wash keeps the centred copy readable. */}
        <div className="absolute inset-0 -z-10 bg-[#a08cff]/70 mix-blend-color" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(24,14,70,0.55)_0%,rgba(90,60,220,0.18)_42%,rgba(14,9,36,0.82)_100%)]" />

        <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden>
          <motion.path
            d="M -50 760 C 260 690, 420 790, 640 700 S 960 610, 1250 660"
            fill="none"
            stroke="#c8f34a"
            strokeWidth="1.6"
            strokeDasharray="6 12"
            strokeOpacity="0.4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.8, ease: "easeInOut", delay: 0.5 }}
          />
        </svg>

        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-28 text-center sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mb-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs text-white/80 ring-1 ring-white/20 backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />
            {t("hero.badge")}
          </motion.div>

          <h1 className="max-w-4xl font-display text-[2.55rem] font-light leading-[1.02] tracking-[-0.045em] sm:text-6xl md:text-[5.4rem]">
            {[t("hero.title1"), t("hero.title2"), t("hero.title3")].map((line, i) => (
              <span key={i} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className={`block ${i === 1 ? "text-[#d9d0ff]" : ""}`}
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.95, ease: EASE, delay: 0.15 + i * 0.1 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
            className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-base"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.62 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <DotButton href="/login?role=customer">{t("hero.orderNow").replace(" →", "")}</DotButton>
            <Link
              href="/login?role=rider"
              className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/20"
            >
              {t("hero.becomeRider")}
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.8 }}
          className="grid grid-cols-3 gap-2 p-2.5 sm:gap-3 sm:p-4"
        >
          <HeroStat value={5} suffix={t("hero.minSuffix")} label={t("hero.stat1")} />
          <HeroStat value={3} suffix="×" label={t("hero.stat2")} />
          <HeroStat value={2} suffix="-opt" label={t("hero.stat3")} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function HeroStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/[0.08] p-3.5 text-left ring-1 ring-white/15 backdrop-blur-md sm:rounded-[1.8rem] sm:p-5">
      <StatCounter value={value} suffix={suffix} decimals={0} className="whitespace-nowrap font-display text-xl font-light tracking-tight sm:text-4xl" />
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/60 sm:text-xs">{label}</p>
    </div>
  );
}

function About() {
  const { t } = useLanguage();
  const marquee = t("about.marquee");
  return (
    <section className={`${WRAP} mt-3 sm:mt-4`}>
      <div className="sheet overflow-hidden">
        <div className="grid gap-8 px-6 pb-10 pt-10 sm:px-12 sm:pt-14 md:grid-cols-[0.34fr_1fr]">
          <Reveal>
            <Eyebrow>{t("about.eyebrow")}</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="max-w-3xl font-display text-2xl font-light leading-[1.2] tracking-[-0.03em] sm:text-4xl">{t("about.statement")}</p>
          </Reveal>
        </div>
        <div className="grid grid-cols-3 gap-4 px-6 pb-12 sm:px-12 md:ml-[25.4%] md:pl-0">
          {[
            { v: 20, s: " km", k: "about.stat1" },
            { v: 4, s: "", k: "about.stat2" },
            { v: 3, s: "", k: "about.stat3" },
          ].map((x, i) => (
            <Reveal key={x.k} delay={0.08 * i}>
              <StatCounter value={x.v} suffix={x.s} decimals={0} className="whitespace-nowrap font-display text-[2rem] font-light tracking-[-0.05em] sm:text-7xl" />
              <p className="mt-2 max-w-[14rem] text-xs leading-snug text-text-dim sm:text-sm">{t(x.k)}</p>
            </Reveal>
          ))}
        </div>
        {/* The lavender band from the reference, carrying a slow marquee of
            what is inside the product. */}
        <div className="relative overflow-hidden bg-[linear-gradient(90deg,var(--brand),#a58cff_45%,#9ec1ff)] py-4 text-white">
          <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-8 whitespace-nowrap font-display text-lg font-light tracking-tight sm:text-2xl">
            <span>{marquee}</span>
            <span aria-hidden>{marquee}</span>
            <span aria-hidden>{marquee}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Portals() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(0);
  return (
    <section id="roles" className={`${WRAP} mt-3 scroll-mt-24 sm:mt-4`}>
      <div className="sheet-wash px-6 py-10 sm:px-12 sm:py-14">
        <div className="grid gap-8 md:grid-cols-[0.34fr_1fr]">
          <Reveal className="flex flex-col items-start gap-5">
            <Eyebrow>{t("roles.eyebrow")}</Eyebrow>
            <DotButton href="/login" tone="light">
              {t("nav.getStarted")}
            </DotButton>
          </Reveal>

          <div>
            <Reveal>
              <h2 className="max-w-2xl font-display text-3xl font-light leading-[1.1] tracking-[-0.035em] sm:text-5xl">{t("roles.title")}</h2>
              <div className="mt-6 flex flex-wrap gap-2">
                {FEATURES.map((f) => (
                  <span key={f} className="rounded-full bg-surface/70 px-3 py-1.5 text-xs text-text ring-1 ring-white/60 backdrop-blur dark:ring-white/10">
                    {t(`${f}.title`)}
                  </span>
                ))}
              </div>
            </Reveal>

            <div className="mt-10 divide-y divide-text/10 border-y border-text/10">
              {ROLES.map((role, i) => {
                const isOpen = open === i;
                return (
                  <div key={role.key}>
                    <button
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    >
                      <span className="flex items-baseline gap-4">
                        <span className="font-mono text-xs text-text-dim">0{i + 1}</span>
                        <span className="font-display text-xl font-light tracking-tight sm:text-3xl">{t(role.titleKey)}</span>
                      </span>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                          isOpen ? "rotate-45 bg-ink text-white" : "bg-surface text-text"
                        }`}
                      >
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                      </span>
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-5 pb-7 sm:grid-cols-[1fr_minmax(0,260px)] sm:pl-9">
                        <div>
                          <p className="max-w-lg text-sm leading-relaxed text-text-dim sm:text-base">{t(role.descKey)}</p>
                          <DotButton href={`/login?role=${role.key}`} tone="ink" className="mt-5">
                            {t(role.ctaKey)}
                          </DotButton>
                        </div>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                          <Image src={role.image} alt="" fill sizes="260px" className="object-cover" />
                          <div className="absolute inset-0 bg-[#a08cff]/45 mix-blend-color" />
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className={`${WRAP} mt-3 scroll-mt-24 sm:mt-4`}>
      <div className="sheet-ink relative isolate overflow-hidden px-6 py-10 sm:px-12 sm:py-14">
        <Image src="/images/landing/how-it-works.webp" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_85%_0%,rgba(122,92,255,0.35),transparent_60%),linear-gradient(180deg,rgba(12,10,18,0.55),#0c0a12_75%)]" />

        <div className="grid gap-6 md:grid-cols-[0.34fr_1fr]">
          <Reveal>
            <Eyebrow light>{t("how.eyebrow")}</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="max-w-2xl font-display text-3xl font-light leading-[1.1] tracking-[-0.035em] sm:text-5xl">{t("how.title")}</h2>
          </Reveal>
        </div>

        <div className="mt-10 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((key, i) => (
            <Reveal key={key} delay={0.07 * i}>
              <div className="flex h-full flex-col rounded-[1.6rem] bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-white/[0.1]">
                <span className="flex items-center gap-2 text-xs text-white/50">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono">0{i + 1}</span>
                  <span className="h-px flex-1 bg-white/10" />
                </span>
                <h3 className="mt-6 font-display text-xl font-normal tracking-tight">{t(`${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{t(`${key}.desc`)}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Link
          href="/login?role=customer"
          className="group mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-brand py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#7d63ff]"
        >
          {t("roles.customer.cta")}
          <span className="cta-dot h-6 w-6 transition-transform group-hover:translate-x-1">
            <Arrow className="h-3 w-3" />
          </span>
        </Link>
      </div>
    </section>
  );
}

const FEATURE_ICON: Record<(typeof FEATURES)[number], React.ReactNode> = {
  "features.gps": <><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="7.5" /></>,
  "features.autoAssign": <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  "features.selfHealing": <><path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" /><path d="M18 2v4.4h-4.4M6 22v-4.4h4.4" /></>,
  "features.penalty": <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" />,
  "features.auth": <><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  "features.console": <><rect x="3" y="4.5" width="18" height="15" rx="3.5" /><path d="m7.5 10 3 2.5-3 2.5M13 15h3.5" /></>,
};

function Features() {
  const { t } = useLanguage();
  const track = useRef<HTMLDivElement>(null);
  const nudge = (dir: number) => track.current?.scrollBy({ left: dir * 340, behavior: "smooth" });

  return (
    <section id="features" className={`${WRAP} mt-3 scroll-mt-24 sm:mt-4`}>
      <div className="sheet overflow-hidden py-10 sm:py-14">
        <div className="grid gap-6 px-6 sm:px-12 md:grid-cols-[0.34fr_1fr]">
          <Reveal>
            <Eyebrow>{t("features.eyebrow")}</Eyebrow>
          </Reveal>
          <Reveal delay={0.05} className="flex flex-wrap items-end justify-between gap-5">
            <h2 className="max-w-xl font-display text-3xl font-light leading-[1.1] tracking-[-0.035em] sm:text-5xl">{t("features.title")}</h2>
            <div className="flex gap-2">
              <button onClick={() => nudge(-1)} aria-label={t("features.prev")} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-raised text-text transition-colors hover:bg-brand hover:text-white">
                <Arrow className="h-4 w-4 rotate-180" />
              </button>
              <button onClick={() => nudge(1)} aria-label={t("features.next")} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-brand">
                <Arrow className="h-4 w-4" />
              </button>
            </div>
          </Reveal>
        </div>

        <div
          ref={track}
          className="mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-2 [scrollbar-width:none] sm:scroll-px-12 sm:px-12 [&::-webkit-scrollbar]:hidden"
        >
          <div className="sheet-wash flex w-[250px] shrink-0 snap-start flex-col justify-between rounded-[1.8rem] p-6 sm:w-[280px]">
            <p className="font-display text-7xl font-light tracking-[-0.06em]">6</p>
            <div>
              <p className="text-sm text-text-dim">{t("features.count")}</p>
              <div className="mt-4 flex -space-x-2">
                {FEATURES.slice(0, 4).map((f) => (
                  <span key={f} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-brand ring-2 ring-wash">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {FEATURE_ICON[f]}
                    </svg>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {FEATURES.map((f, i) => (
            <motion.article
              key={f}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.7, ease: EASE, delay: Math.min(i, 3) * 0.06 }}
              className="flex w-[280px] shrink-0 snap-start flex-col rounded-[1.8rem] bg-surface-raised p-6 sm:w-[320px]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-brand shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {FEATURE_ICON[f]}
                </svg>
              </span>
              <h3 className="mt-8 font-display text-xl font-normal tracking-tight">{t(`${f}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{t(`${f}.desc`)}</p>
            </motion.article>
          ))}

          <ConsolePreview />
        </div>
        <p className="mt-5 px-6 text-xs text-text-dim sm:hidden">{t("features.swipe")} →</p>
      </div>
    </section>
  );
}

function ConsolePreview() {
  const { t } = useLanguage();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 2200);
    return () => clearInterval(id);
  }, []);

  // Addresses stay in English: they are data, as on the real board.
  const rows = [
    { label: "Park Street, Kolkata", status: "assigned" },
    { label: "Salt Lake Sector V", status: "offered" },
    { label: "Ballygunge Place", status: "delivered" },
    { label: "New Town Action Area I", status: "pending" },
  ];
  const KPI_KEY: Record<string, string> = { pending: "pending", offered: "awaitingAccept", assigned: "inProgress", delivered: "delivered" };
  const tone: Record<string, string> = {
    pending: "bg-white/10 text-white/70",
    offered: "bg-brand/30 text-[#d9d0ff]",
    assigned: "bg-lime/20 text-lime",
    delivered: "bg-success/20 text-success",
  };
  const live = tick % rows.length;

  return (
    <div className="sheet-ink flex w-[330px] shrink-0 snap-start flex-col rounded-[1.8rem] p-5 sm:w-[520px]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{t("preview.title")}</p>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/70">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />
          live
        </span>
      </div>
      <div className="mt-4 grid flex-1 gap-3 sm:grid-cols-[1fr_1.1fr]">
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-xs transition-colors duration-500 ${i === live ? "bg-white/[0.12]" : "bg-white/[0.05]"}`}
            >
              <span className="truncate text-white/75">{r.label}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone[r.status]}`}>{t(`admin.kpi.${KPI_KEY[r.status]}`)}</span>
            </div>
          ))}
        </div>
        <div className="relative hidden min-h-[180px] overflow-hidden rounded-2xl bg-white/[0.04] sm:block">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 200" aria-hidden>
            <motion.path
              d="M 24 170 C 80 110, 120 150, 150 95 S 220 40, 240 50"
              fill="none"
              stroke="#a996ff"
              strokeWidth="2.2"
              strokeDasharray="5 7"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
            <circle cx="24" cy="170" r="5" fill="#f1eff8" />
            <circle cx="240" cy="50" r="6" fill="#c8f34a" />
            <motion.circle
              r="4.5"
              fill="#c8f34a"
              cx={24}
              cy={170}
              initial={{ cx: 24, cy: 170 }}
              animate={{ cx: [24, 150, 240], cy: [170, 95, 50] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function FinalCta() {
  const { t } = useLanguage();
  return (
    <section className={`${WRAP} mt-3 sm:mt-4`}>
      <Reveal>
        <div className="relative isolate flex min-h-[26rem] flex-col items-center justify-center overflow-hidden rounded-[2rem] px-6 py-16 text-center text-white sm:min-h-[32rem] sm:rounded-[2.6rem]">
          <Image src="/images/landing/rider.webp" alt="" fill sizes="(max-width: 1400px) 100vw, 1400px" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-[#a08cff]/70 mix-blend-color" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_70%_at_50%_50%,rgba(20,12,56,0.35),rgba(14,9,36,0.8))]" />
          <h2 className="max-w-2xl font-display text-4xl font-light leading-[1.05] tracking-[-0.04em] sm:text-6xl">{t("cta.title")}</h2>
          <p className="mt-4 max-w-md text-sm text-white/70 sm:text-base">{t("cta.subtitle")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <DotButton href="/login?role=customer">{t("hero.orderNow").replace(" →", "")}</DotButton>
            <Link href="/login?role=rider" className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/20">
              {t("hero.becomeRider")}
            </Link>
            <Link href="/login?role=admin" className="rounded-full px-5 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white">
              {t("roles.admin.cta")}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  const cols = [
    {
      title: t("footer.product"),
      links: [
        { href: "#how-it-works", label: t("nav.howItWorks") },
        { href: "#features", label: t("nav.features") },
        { href: "#roles", label: t("nav.getStarted") },
      ],
    },
    {
      title: t("footer.portals"),
      links: [
        { href: "/login?role=customer", label: t("roles.customer.title") },
        { href: "/login?role=rider", label: t("roles.rider.title") },
        { href: "/login?role=admin", label: t("roles.admin.title") },
      ],
    },
  ];
  return (
    <footer className={`${WRAP} mb-3 mt-3 sm:mb-4 sm:mt-4`}>
      <div className="sheet-ink relative overflow-hidden px-6 pb-8 pt-10 sm:px-12 sm:pt-14">
        <div className="grid gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <LogoMark className="h-12 w-12" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">{t("about.statement")}</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">{c.title}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-white/75 transition-colors hover:text-lime">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p
          aria-hidden
          className="mt-12 select-none font-display text-[22vw] font-light leading-[0.8] tracking-[-0.07em] text-white/[0.92] sm:text-[11rem] lg:text-[14rem]"
        >
          dispatch<span className="text-lime">.</span>
        </p>
        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {t("footer.rights")}</span>
          <span>{t("footer.builtBy")}</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="relative overflow-x-clip">
      <PageBackground accent="both" />
      <Nav />
      <Hero />
      <About />
      <Portals />
      <HowItWorks />
      <Features />
      <FinalCta />
      <Footer />
    </div>
  );
}
