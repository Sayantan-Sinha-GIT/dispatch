"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { StatCounter } from "@/components/StatCounter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";

const NAV_LINKS = [
  { href: "#how-it-works", key: "nav.howItWorks" },
  { href: "#roles", key: "nav.getStarted" },
  { href: "#features", key: "nav.features" },
] as const;

const ROLES = [
  {
    key: "customer",
    accent: "amber",
    titleKey: "roles.customer.title",
    descKey: "roles.customer.desc",
    ctaKey: "roles.customer.cta",
    icon: "🛒",
    image: "/images/landing/customer.webp",
  },
  {
    key: "rider",
    accent: "cyan",
    titleKey: "roles.rider.title",
    descKey: "roles.rider.desc",
    ctaKey: "roles.rider.cta",
    icon: "🛵",
    image: "/images/landing/rider.webp",
  },
  {
    key: "admin",
    accent: "amber",
    titleKey: "roles.admin.title",
    descKey: "roles.admin.desc",
    ctaKey: "roles.admin.cta",
    icon: "📡",
    image: "/images/landing/admin.webp",
  },
] as const;

const STEPS = [
  { n: "01", key: "how.step1" },
  { n: "02", key: "how.step2" },
  { n: "03", key: "how.step3" },
  { n: "04", key: "how.step4" },
];

const FEATURES = [
  { icon: "🧭", key: "features.gps" },
  { icon: "⚡", key: "features.autoAssign" },
  { icon: "🔁", key: "features.selfHealing" },
  { icon: "🛡️", key: "features.penalty" },
  { icon: "🔐", key: "features.auth" },
  { icon: "📊", key: "features.console" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-border bg-bg/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-amber/60 font-display text-sm font-bold text-bg">
            D
          </span>
          <span className={`font-display text-base font-semibold transition-colors ${scrolled ? "" : "text-white"}`}>Dispatch</span>
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                scrolled ? "text-text-dim hover:text-text" : "text-white/75 hover:text-white"
              }`}
            >
              {t(l.key)}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
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

  // Parallax: the photograph drifts slower than the text scrolling over it,
  // which reads as depth rather than as a moving background.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.16]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const copyFade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <section ref={ref} className="grain relative flex min-h-screen items-center overflow-hidden pt-24">
      <motion.div style={{ y: imageY, scale: imageScale }} className="absolute inset-0">
        {/*
          A plain <picture> rather than next/image: this needs art direction,
          not just resizing. The wide crop puts the rider dead centre, which on
          a phone lands him directly behind the headline. Two separate framings
          are the only honest fix, and <picture> makes the browser download
          exactly one of them.
        */}
        <picture>
          <source media="(max-width: 700px)" srcSet="/images/landing/hero-mobile.webp" />
          <img
            src="/images/landing/hero.webp"
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover object-center brightness-125 contrast-105 saturate-[1.15]"
          />
        </picture>
      </motion.div>

      {/*
        Two scrims, not one. The vertical pass anchors the composition to the
        page background so the photo does not end in a hard seam; the
        horizontal pass darkens the side the copy sits on, so the text keeps
        its contrast wherever the photograph happens to be bright.
      */}
      {/* Fixed dark, not theme-derived: see the note above this component. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070a0f]/75 via-transparent to-[#070a0f]/85" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070a0f] via-[#070a0f]/65 to-transparent sm:via-[#070a0f]/40" />
      {/* The only theme-aware layer: the seam where the photo meets the page. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg" />

      {/* The dispatch route. Kept from the old hero - it is the one decorative
          element that says something true about the product. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden>
        <motion.path
          d="M -50 620 C 220 520, 380 700, 600 545 S 900 330, 1250 400"
          fill="none"
          stroke="#ffb020"
          strokeWidth="2"
          strokeDasharray="7 14"
          strokeOpacity="0.45"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.6, ease: "easeInOut", delay: 0.4 }}
        />
      </svg>

      <motion.div style={{ y: copyY, opacity: copyFade }} className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 py-1.5 text-xs text-white/75 backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          {t("hero.badge")}
        </motion.div>

        <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
          {[t("hero.title1"), t("hero.title2"), t("hero.title3")].map((line, i) => (
            // Lines rise from behind a clipping mask, so the headline
            // assembles itself instead of simply fading in.
            <span key={i} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                className={`block ${i === 1 ? "bg-gradient-to-r from-amber via-amber to-cyan bg-clip-text text-transparent" : ""}`}
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.11 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.55 }}
          className="mt-6 max-w-xl text-base text-white/70 sm:text-lg"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
          className="mt-9 flex flex-wrap gap-3"
        >
          <Link
            href="/login?role=customer"
            className="rounded-full bg-amber px-7 py-3.5 text-sm font-bold text-bg shadow-lg shadow-amber/25 transition-transform hover:scale-[1.04] active:scale-95"
          >
            {t("hero.orderNow")}
          </Link>
          <Link
            href="/login?role=rider"
            className="rounded-full border border-cyan/40 bg-cyan/10 px-7 py-3.5 text-sm font-bold text-cyan backdrop-blur transition-transform hover:scale-[1.04] active:scale-95"
          >
            {t("hero.becomeRider")}
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-white/15 bg-black/25 px-7 py-3.5 text-sm font-semibold text-white/75 backdrop-blur transition-colors hover:text-white"
          >
            {t("hero.seeHow")}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="relative mt-16 grid max-w-2xl grid-cols-3 gap-6 pt-8"
        >
          <div className="rule-fade absolute inset-x-0 top-0" />
          <Stat value={5} suffix=" min" decimals={0} label={t("hero.stat1")} />
          <Stat value={3} suffix="×" decimals={0} label={t("hero.stat2")} />
          <Stat value={2} suffix="-opt" decimals={0} label={t("hero.stat3")} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function Stat({ value, suffix, decimals, label }: { value: number; suffix: string; decimals: number; label: string }) {
  return (
    <div>
      <StatCounter value={value} suffix={suffix} decimals={decimals} className="font-display text-3xl font-bold text-amber" />
      {/* Hero-only, so it follows the hero rather than the page theme. */}
      <p className="mt-1 text-xs text-white/60">{label}</p>
    </div>
  );
}

function RoleCards() {
  const { t } = useLanguage();
  return (
    <section id="roles" className="relative mx-auto max-w-6xl px-6 py-28">
      <SectionHeading eyebrow={t("roles.eyebrow")} title={t("roles.title")} />
      <div className="mt-14 grid gap-5 sm:grid-cols-3">
        {ROLES.map((role, i) => (
          <motion.div
            key={role.key}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
            whileHover={{ y: -10 }}
            className="group surface-raised-soft grain relative overflow-hidden rounded-3xl ring-1 ring-border/60"
          >
            <div className="relative h-44 overflow-hidden">
              <Image
                src={role.image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              {/* Fades the photo into the card body, so the image and the text
                  read as one object rather than a picture stuck on a box. */}
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/55 to-transparent" />
              <span
                className={`absolute bottom-3 left-5 flex h-11 w-11 items-center justify-center rounded-2xl text-xl shadow-lg backdrop-blur-md ${
                  role.accent === "amber" ? "bg-amber/20 shadow-amber/20" : "bg-cyan/20 shadow-cyan/20"
                }`}
              >
                {role.icon}
              </span>
            </div>

            <div className="relative p-7 pt-5">
              <h3 className="font-display text-xl font-bold">{t(role.titleKey)}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-text-dim">{t(role.descKey)}</p>
              <Link
                href={`/login?role=${role.key}`}
                className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-1 ${
                  role.accent === "amber" ? "text-amber" : "text-cyan"
                }`}
              >
                {t(role.ctaKey)} →
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className="grain relative overflow-hidden py-28">
      {/* The aerial night map sits far back. At this opacity it reads as
          atmosphere rather than as a picture competing with the steps. */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/landing/how-it-works.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.22]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/85 to-bg" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6">
      <SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} />
      <div className="relative mt-16 space-y-12 pl-8 sm:pl-10">
        <motion.div
          className="absolute bottom-4 left-[11px] top-4 w-px bg-gradient-to-b from-amber via-cyan to-transparent sm:left-[15px]"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{ transformOrigin: "top" }}
        />
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="relative"
          >
            <span className="absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-amber text-[10px] font-bold text-bg sm:-left-10 sm:h-7 sm:w-7">
              {i + 1}
            </span>
            <p className="mb-1 font-mono text-xs text-text-dim">{step.n}</p>
            <h3 className="font-display text-xl font-bold">{t(`${step.key}.title`)}</h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-dim">{t(`${step.key}.desc`)}</p>
          </motion.div>
        ))}
      </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useLanguage();
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-28">
      <SectionHeading eyebrow={t("features.eyebrow")} title={t("features.title")} />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            whileHover={{ y: -4, borderColor: "rgba(255,176,32,0.4)" }}
            className="rounded-2xl border border-border bg-surface p-6 transition-colors"
          >
            <span className="text-2xl">{f.icon}</span>
            <h3 className="mt-4 font-display text-base font-bold">{t(`${f.key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">{t(`${f.key}.desc`)}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function LiveConsolePreview() {
  const { t } = useLanguage();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(id);
  }, []);

  const rows = [
    { label: "MG Road, Bangalore", status: "assigned" },
    { label: "Koramangala 5th Block", status: "offered" },
    { label: "HSR Layout Sector 2", status: "delivered" },
    { label: "Whitefield Main Road", status: "pending" },
  ];
  const colors: Record<string, string> = {
    pending: "bg-text-dim/20 text-text-dim",
    offered: "bg-amber/20 text-amber",
    assigned: "bg-cyan/20 text-cyan",
    delivered: "bg-success/20 text-success",
  };

  return (
    <section className="relative mx-auto max-w-5xl px-6 py-28">
      <SectionHeading eyebrow={t("preview.eyebrow")} title={t("preview.title")} />
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 8 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mt-14 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/40"
        style={{ perspective: 1000 }}
      >
        <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <span className="ml-3 font-mono text-[11px] text-text-dim">{t("preview.windowTitle")}</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1.3fr]">
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {rows.map((r, i) => (
                <motion.div
                  key={r.label}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2.5 text-xs"
                >
                  <span className="truncate pr-2 text-text-dim">{r.label}</span>
                  <span
                    key={`${t(`status.${r.status}`)}-${tick}-${i}`}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors[r.status]}`}
                  >
                    {r.status}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="relative min-h-[220px] overflow-hidden rounded-xl bg-gradient-to-br from-surface-raised to-surface">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 220" aria-hidden>
              <motion.path
                d="M 30 180 C 100 120, 160 160, 210 100 S 320 40, 370 60"
                fill="none"
                stroke="#2dd4c4"
                strokeWidth="2.5"
                strokeDasharray="6 8"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
              <circle cx="30" cy="180" r="5" fill="#e8ecf1" />
              <circle cx="370" cy="60" r="6" fill="#2dd4c4" />
              <motion.circle
                r="4"
                fill="#ffb020"
                // cx/cy must exist before they can be animated. Without them the
                // browser is handed cx="undefined" on every frame.
                cx={30}
                cy={180}
                initial={{ cx: 30, cy: 180 }}
                animate={{ cx: [30, 210, 370], cy: [180, 100, 60] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function FinalCta() {
  const { t } = useLanguage();
  return (
    <section className="relative mx-auto max-w-5xl px-6 py-28">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7 }}
        className="grain relative overflow-hidden rounded-[2rem] p-12 text-center ring-1 ring-amber/20 sm:p-16"
      >
        <Image
          src="/images/landing/cta.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover"
        />
        {/* Deliberately heavy. This image exists to be a texture behind the
            words, not something anyone should stop to look at. */}
        <div className="absolute inset-0 bg-bg/80" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber/10 via-transparent to-cyan/10" />
        <h2 className="relative font-display text-3xl font-bold sm:text-4xl">{t("cta.title")}</h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-text-dim">{t("cta.subtitle")}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login?role=customer" className="rounded-full bg-amber px-7 py-3.5 text-sm font-bold text-bg shadow-lg shadow-amber/25 transition-transform hover:scale-[1.04] active:scale-95">
            {t("hero.orderNow").replace(" →", "")}
          </Link>
          <Link href="/login?role=rider" className="rounded-full border border-cyan/40 bg-cyan/10 px-7 py-3.5 text-sm font-bold text-cyan backdrop-blur transition-transform hover:scale-[1.04] active:scale-95">
            {t("hero.becomeRider")}
          </Link>
          <Link href="/login?role=admin" className="rounded-full border border-white/10 bg-black/20 px-7 py-3.5 text-sm font-semibold text-text-dim backdrop-blur transition-colors hover:text-text">
            {t("roles.admin.cta")}
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber font-display text-xs font-bold text-bg">D</span>
          <div className="flex flex-col">
            <span className="text-sm text-text-dim">© {new Date().getFullYear()} {t("footer.rights")}</span>
            <span className="text-xs text-text-dim">{t("footer.builtBy")}</span>
          </div>
        </div>
        <div className="flex gap-6 text-xs text-text-dim">
          <a href="#how-it-works" className="hover:text-text">{t("nav.howItWorks")}</a>
          <a href="#features" className="hover:text-text">{t("nav.features")}</a>
          <Link href="/login" className="hover:text-text">{t("nav.signIn")}</Link>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber">{eyebrow}</p>
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      <Nav />
      <Hero />
      <RoleCards />
      <HowItWorks />
      <Features />
      <LiveConsolePreview />
      <FinalCta />
      <Footer />
    </div>
  );
}
