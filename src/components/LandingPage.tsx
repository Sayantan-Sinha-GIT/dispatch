"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
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
  },
  {
    key: "rider",
    accent: "cyan",
    titleKey: "roles.rider.title",
    descKey: "roles.rider.desc",
    ctaKey: "roles.rider.cta",
    icon: "🛵",
  },
  {
    key: "admin",
    accent: "amber",
    titleKey: "roles.admin.title",
    descKey: "roles.admin.desc",
    ctaKey: "roles.admin.cta",
    icon: "📡",
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

function GradientBlob({ className, color }: { className: string; color: string }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-[100px] ${className}`}
      style={{ background: color }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

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
          <span className="font-display text-base font-semibold">Dispatch</span>
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-text-dim transition-colors hover:text-text">
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
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const glowX = useSpring(mx, { stiffness: 40, damping: 20 });
  const glowY = useSpring(my, { stiffness: 40, damping: 20 });
  const glowLeft = useTransform(glowX, (v) => `${v * 100}%`);
  const glowTop = useTransform(glowY, (v) => `${v * 100}%`);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  }

  return (
    <section
      ref={ref}
      onMouseMove={handleMouseMove}
      className="relative flex min-h-screen items-center overflow-hidden pt-24"
    >
      <div className="pointer-events-none absolute inset-0">
        <GradientBlob className="-left-40 top-10 h-[28rem] w-[28rem]" color="rgba(255,176,32,0.18)" />
        <GradientBlob className="-right-32 bottom-0 h-[24rem] w-[24rem]" color="rgba(45,212,196,0.14)" />
        <motion.div
          className="absolute h-72 w-72 rounded-full bg-amber/10 blur-3xl"
          style={{ left: glowLeft, top: glowTop, translateX: "-50%", translateY: "-50%" }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden>
          <defs>
            <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden>
          <motion.path
            d="M -50 550 C 200 450, 350 650, 550 500 S 850 300, 1250 380"
            fill="none"
            stroke="#ffb020"
            strokeWidth="2"
            strokeDasharray="8 12"
            strokeOpacity="0.3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.5, ease: "easeInOut", delay: 0.3 }}
          />
        </svg>

        {["🛵", "📦", "🛒", "📍"].map((emoji, i) => (
          <motion.div
            key={emoji}
            className="absolute text-3xl opacity-30 sm:text-4xl"
            style={{ left: `${15 + i * 22}%`, top: `${20 + (i % 2) * 45}%` }}
            animate={{ y: [0, -18, 0], rotate: [0, i % 2 === 0 ? 8 : -8, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-xs text-text-dim backdrop-blur"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          {t("hero.badge")}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className="max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
        >
          {t("hero.title1")}{" "}
          <span className="bg-gradient-to-r from-amber via-amber to-cyan bg-[length:200%_auto] bg-clip-text text-transparent [animation:gradient-shift_6s_ease_infinite]">
            {t("hero.title2")}
          </span>{" "}
          {t("hero.title3")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
          className="mt-6 max-w-xl text-base text-text-dim sm:text-lg"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          className="mt-9 flex flex-wrap gap-3"
        >
          <Link
            href="/login?role=customer"
            className="rounded-xl bg-amber px-6 py-3.5 text-sm font-bold text-bg shadow-lg shadow-amber/20 transition-transform hover:scale-[1.03]"
          >
            {t("hero.orderNow")}
          </Link>
          <Link
            href="/login?role=rider"
            className="rounded-xl border border-cyan/40 bg-cyan/10 px-6 py-3.5 text-sm font-bold text-cyan transition-transform hover:scale-[1.03]"
          >
            {t("hero.becomeRider")}
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-text-dim transition-colors hover:text-text"
          >
            {t("hero.seeHow")}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-border pt-8"
        >
          <Stat value={5} suffix=" min" decimals={0} label={t("hero.stat1")} />
          <Stat value={3} suffix="×" decimals={0} label={t("hero.stat2")} />
          <Stat value={2} suffix="-opt" decimals={0} label={t("hero.stat3")} />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ value, suffix, decimals, label }: { value: number; suffix: string; decimals: number; label: string }) {
  return (
    <div>
      <StatCounter value={value} suffix={suffix} decimals={decimals} className="font-display text-3xl font-bold text-amber" />
      <p className="mt-1 text-xs text-text-dim">{label}</p>
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
            whileHover={{ y: -8 }}
            className={`group relative overflow-hidden rounded-3xl border p-7 ${
              role.accent === "amber" ? "border-amber/20 bg-gradient-to-br from-amber/10 via-surface to-surface" : "border-cyan/20 bg-gradient-to-br from-cyan/10 via-surface to-surface"
            }`}
          >
            <div
              className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${
                role.accent === "amber" ? "bg-amber/20" : "bg-cyan/20"
              } opacity-0`}
            />
            <span className="text-4xl">{role.icon}</span>
            <h3 className="mt-5 font-display text-xl font-bold">{t(role.titleKey)}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-text-dim">{t(role.descKey)}</p>
            <Link
              href={`/login?role=${role.key}`}
              className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-1 ${
                role.accent === "amber" ? "text-amber" : "text-cyan"
              }`}
            >
              {t(role.ctaKey)} →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className="relative mx-auto max-w-4xl px-6 py-28">
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
        className="relative overflow-hidden rounded-3xl border border-amber/20 bg-gradient-to-br from-amber/10 via-surface to-cyan/10 p-12 text-center sm:p-16"
      >
        <GradientBlob className="left-1/2 top-0 h-64 w-64 -translate-x-1/2" color="rgba(255,176,32,0.15)" />
        <h2 className="relative font-display text-3xl font-bold sm:text-4xl">{t("cta.title")}</h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-text-dim">{t("cta.subtitle")}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login?role=customer" className="rounded-xl bg-amber px-6 py-3.5 text-sm font-bold text-bg transition-transform hover:scale-[1.03]">
            {t("hero.orderNow").replace(" →", "")}
          </Link>
          <Link href="/login?role=rider" className="rounded-xl border border-cyan/40 bg-cyan/10 px-6 py-3.5 text-sm font-bold text-cyan transition-transform hover:scale-[1.03]">
            {t("hero.becomeRider")}
          </Link>
          <Link href="/login?role=admin" className="rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-text-dim transition-colors hover:text-text">
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
          <span className="text-sm text-text-dim">© {new Date().getFullYear()} {t("footer.rights")}</span>
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
