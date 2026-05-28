import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import { WelcomeToast } from "@/components/ui/WelcomeToast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Drop4 — Four in a row. Sharper every drop.",
    template: "%s · Drop4",
  },
  description:
    "A modern arena for the oldest tactical duel. Challenge a friend by link, drill against an AI that explains its moves, or climb your city's board.",
  applicationName: "Drop4",
  openGraph: {
    title: "Drop4 — Four in a row. Sharper every drop.",
    description:
      "Challenge a friend by link, drill against an AI that explains its moves, or climb your city's board.",
    siteName: "Drop4",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Without these explicit values Next's defaults can land us with no
  // viewport-fit, which is what breaks safe-area-inset on iOS Safari (and on
  // the Telegram in-app webview that inherits its quirks): a fixed `bottom:0`
  // bar then drifts up by the home-indicator strip and a slice of the page
  // peeks out from underneath it. viewport-fit:cover pins the page to the
  // physical viewport so env(safe-area-inset-*) reports real numbers.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
  ],
  colorScheme: "dark light",
};

// Runs before first paint to avoid a theme flash: stored choice wins, else
// system preference, else dark (the design's default).
const themeBootstrap = `(function(){try{var s=localStorage.getItem('drop4-theme');var m=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=(s==='light'||s==='dark')?s:m;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <WelcomeToast />
      </body>
    </html>
  );
}
