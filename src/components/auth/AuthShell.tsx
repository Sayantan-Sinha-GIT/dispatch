"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthBackground } from "@/components/AuthBackground";

const PHOTO = {
  customer: "/images/landing/customer.webp",
  rider: "/images/landing/rider.webp",
  admin: "/images/landing/admin.webp",
} as const;

/**
 * Every sign-in-shaped screen: the landing page's photographic sheet on the
 * left carrying one large line, the form on a white sheet on the right. On a
 * phone the photograph shrinks to a band above the form, so the first thing
 * seen is still a place and not an empty field.
 */
export function AuthShell({
  role = "customer",
  headline,
  sub,
  children,
}: {
  role?: keyof typeof PHOTO;
  headline: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const accent = role === "rider" ? "zest" : "brand";
  return (
    <div className="relative flex min-h-screen flex-col p-2.5 sm:p-4">
      <AuthBackground accent={accent} />

      <div className="relative grid flex-1 gap-2.5 sm:gap-4 lg:grid-cols-[1.1fr_1fr]">
        <motion.aside
          key={role}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative isolate flex min-h-[13rem] flex-col justify-between overflow-hidden rounded-[2rem] p-5 text-white sm:p-8 lg:min-h-0 lg:rounded-[2.6rem] lg:p-10"
        >
          <Image src={PHOTO[role]} alt="" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.4),rgba(0,0,0,0.05)_40%,rgba(0,0,0,0.8))]" />

          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Dispatch">
              <Logo light />
            </Link>
            <div className="flex gap-1.5 lg:hidden">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-10">
            <h1 className="max-w-lg font-display text-3xl font-light leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{headline}</h1>
            {sub && <p className="mt-4 hidden max-w-md text-sm leading-relaxed text-white/70 sm:block">{sub}</p>}
          </div>
        </motion.aside>

        <main className="sheet relative flex flex-col px-5 py-7 sm:px-10 sm:py-10 lg:rounded-[2.6rem]">
          <div className="hidden justify-end gap-1.5 lg:flex">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
