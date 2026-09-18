"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { StatCounter } from "@/components/StatCounter";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Get started" },
  { href: "#features", label: "Features" },
];

const ROLES = [
  {
    key: "customer",
    accent: "amber",
    title: "Order groceries",
    desc: "Browse a curated catalog and get it delivered by the nearest available rider — often before you'd finish a supermarket queue.",
    cta: "Start shopping",
    icon: "🛒",
  },
  {
    key: "rider",
    accent: "cyan",
    title: "Deliver & earn",
    desc: "Go active, get offered nearby drops, accept in one tap. You control your hours — flip online whenever you're free.",
    cta: "Become a rider",
    icon: "🛵",
  },
  {
    key: "admin",
    accent: "amber",
    title: "Run dispatch",
    desc: "Bulk-import orders, watch a live optimized route map, and let the engine auto-reassign anything a rider misses.",
    cta: "Admin console",
    icon: "📡",
  },
] as const;

const STEPS = [
  { n: "01", title: "Order comes in", desc: "A customer checks out, or an admin pastes messy order text that Gemini turns into structured stops." },
  { n: "02", title: "Engine optimizes", desc: "A nearest-neighbor + 2-opt route solver finds the shortest path across every active rider's capacity." },
  { n: "03", title: "Nearest rider offered", desc: "The closest free, unsuspended rider gets a 5-minute accept window — no scramble, no group chat." },
  { n: "04", title: "Live to delivered", desc: "GPS updates stream in real time until drop-off. Miss the window enough times and it reroutes automatically." },
];

const FEATURES = [
  { icon: "🧭", title: "Live GPS tracking", desc: "Every active rider's position streams to the map in real time — for admins and the customer waiting on their order." },
  { icon: "⚡", title: "Auto-assignment", desc: "Customer orders skip the queue and get offered to the nearest free rider the instant they're placed." },
  { icon: "🔁", title: "Self-healing routes", desc: "Unaccepted offers expire and reroute to the next-nearest rider — no order is ever stuck waiting on one person." },
  { icon: "🛡️", title: "Fair penalty system", desc: "Three missed offers in a row trigger a cool-down suspension, not an instant ban — accountability without cruelty." },
  { icon: "🔐", title: "Google & OTP sign-in", desc: "Customers and riders sign in with Google or a one-time email code. No passwords to forget." },
  { icon: "📊", title: "Command console", desc: "Admins get a live KPI dashboard, a clickable order-to-map focus view, and full product/customer management." },
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
              {l.label}
            </a>
          ))}
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </motion.nav>
  );
}

function Hero() {
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
          Live route optimization, running right now
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className="max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
        >
          Groceries there{" "}
          <span className="bg-gradient-to-r from-amber via-amber to-cyan bg-[length:200%_auto] bg-clip-text text-transparent [animation:gradient-shift_6s_ease_infinite]">
            before you've unpacked
          </span>{" "}
          the car.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
          className="mt-6 max-w-xl text-base text-text-dim sm:text-lg"
        >
          Dispatch pairs a real vehicle-routing engine with a gig-style rider network — instant order matching,
          live tracking, and a dispatch console built for people who actually run logistics.
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
            Order now →
          </Link>
          <Link
            href="/login?role=rider"
            className="rounded-xl border border-cyan/40 bg-cyan/10 px-6 py-3.5 text-sm font-bold text-cyan transition-transform hover:scale-[1.03]"
          >
            Become a rider
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-text-dim transition-colors hover:text-text"
          >
            See how it works ↓
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-border pt-8"
        >
          <Stat value={5} suffix=" min" decimals={0} label="Accept window before reassignment" />
          <Stat value={3} suffix="×" decimals={0} label="Portals — customer, rider, admin" />
          <Stat value={2} suffix="-opt" decimals={0} label="Route optimization pass" />
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
  return (
    <section id="roles" className="relative mx-auto max-w-6xl px-6 py-28">
      <SectionHeading eyebrow="Three ways in" title="Built for everyone in the loop" />
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
            <h3 className="mt-5 font-display text-xl font-bold">{role.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-text-dim">{role.desc}</p>
            <Link
              href={`/login?role=${role.key}`}
              className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-1 ${
                role.accent === "amber" ? "text-amber" : "text-cyan"
              }`}
            >
              {role.cta} →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative mx-auto max-w-4xl px-6 py-28">
      <SectionHeading eyebrow="Under the hood" title="How the dispatch engine works" />
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
            <h3 className="font-display text-xl font-bold">{step.title}</h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-dim">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-28">
      <SectionHeading eyebrow="Everything included" title="Production-grade, not a prototype" />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            whileHover={{ y: -4, borderColor: "rgba(255,176,32,0.4)" }}
            className="rounded-2xl border border-border bg-surface p-6 transition-colors"
          >
            <span className="text-2xl">{f.icon}</span>
            <h3 className="mt-4 font-display text-base font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function LiveConsolePreview() {
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
      <SectionHeading eyebrow="A glimpse inside" title="The console dispatchers actually use" />
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
          <span className="ml-3 font-mono text-[11px] text-text-dim">dispatch console — live</span>
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
                    key={`${r.status}-${tick}-${i}`}
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
        <h2 className="relative font-display text-3xl font-bold sm:text-4xl">Ready to move faster?</h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-text-dim">
          Whichever side of the delivery you're on, it starts with one sign-in.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login?role=customer" className="rounded-xl bg-amber px-6 py-3.5 text-sm font-bold text-bg transition-transform hover:scale-[1.03]">
            Order now
          </Link>
          <Link href="/login?role=rider" className="rounded-xl border border-cyan/40 bg-cyan/10 px-6 py-3.5 text-sm font-bold text-cyan transition-transform hover:scale-[1.03]">
            Become a rider
          </Link>
          <Link href="/login?role=admin" className="rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-text-dim transition-colors hover:text-text">
            Admin console
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber font-display text-xs font-bold text-bg">D</span>
          <span className="text-sm text-text-dim">© {new Date().getFullYear()} Dispatch</span>
        </div>
        <div className="flex gap-6 text-xs text-text-dim">
          <a href="#how-it-works" className="hover:text-text">How it works</a>
          <a href="#features" className="hover:text-text">Features</a>
          <Link href="/login" className="hover:text-text">Sign in</Link>
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
