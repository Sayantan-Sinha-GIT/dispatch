import type { Metadata } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import { NativeBackButton } from "@/components/NativeBackButton";
import "./globals.css";

// One family for headings and text, as in the reference designs: light
// weights for the big lines, regular and medium for everything else.
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Light is the default; the boot script below switches to dark only for
      // someone who chose it, before the first paint.
      data-theme="light"
      suppressHydrationWarning
      className={`${onest.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <LanguageProvider>{children}</LanguageProvider>
        <NativeBackButton />
      </body>
    </html>
  );
}
