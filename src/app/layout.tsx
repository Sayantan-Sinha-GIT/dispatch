import type { Metadata } from "next";
import { Onest, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import { NativeShell } from "@/components/NativeShell";
import { DataSaverProvider } from "@/components/DataSaverProvider";
import { DataSaverNotice } from "@/components/DataSaverToggle";
import { getInitialSaver } from "@/lib/dataSaverServer";
import "./globals.css";

// Headings in Bricolage Grotesque - a grotesque with some personality in
// its curves - over Onest for everything people read at length.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Dispatch — Hyperlocal delivery",
  description: "Hyperlocal delivery dispatch and route optimization",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dispatch",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f0f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0b14" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Decided on the server so a slow phone is sent the light page from the
  // first byte, instead of starting full-size photos and then changing its mind.
  const saver = await getInitialSaver();
  return (
    <html
      lang="en"
      // Light is the default; the boot script below switches to dark only for
      // someone who chose it, before the first paint.
      data-theme="light"
      data-saver={saver.on ? "on" : undefined}
      suppressHydrationWarning
      className={`${bricolage.variable} ${onest.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}`,
          }}
        />
        {/* Data Saver's first look at the connection, before anything else
            loads: lightens this page at once (the React side takes over after)
            and tells the server, via a cookie, for every page after it. Mirrors
            isSlow() in src/lib/dataSaver.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=navigator.connection;if(c){var s=!!c.saveData||/^(slow-2g|2g|3g)$/.test(c.effectiveType||'')||(c.downlink>0&&c.downlink<1);document.cookie='saver-net='+(s?'slow':'fast')+';path=/;max-age=31536000;samesite=lax';var m=(document.cookie.match(/(?:^|; )saver=(on|off)/)||[])[1]||'auto';if(m==='on'||(m==='auto'&&s))document.documentElement.setAttribute('data-saver','on');}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <LanguageProvider>
          <DataSaverProvider initialMode={saver.mode} initialSlow={saver.slow}>
            {children}
            <DataSaverNotice />
          </DataSaverProvider>
        </LanguageProvider>
        <NativeShell />
      </body>
    </html>
  );
}
