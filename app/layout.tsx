import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "./components/AppChrome";
import { PREFERENCE_BOOTSTRAP } from "./lib/preferences";

export const metadata: Metadata = {
  title: {
    default: "QuickKit — Tiny tools. Zero unnecessary uploads.",
    template: "%s — QuickKit",
  },
  description: "Fast utilities for text, data, files, and developer workflows. Your content stays in your browser.",
  applicationName: "QuickKit",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "QuickKit — Useful tools that respect your data",
    description: "Format, inspect, convert, compare, and analyze data directly in your browser.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "QuickKit — Tiny tools. Zero unnecessary uploads." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuickKit — Tiny tools. Zero unnecessary uploads.",
    description: "Ten fast utilities. No account. No unnecessary uploads.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="quickkit-preferences" dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP }} />
      </head>
      <body>
        <noscript><div className="noscript">QuickKit requires JavaScript because every tool processes data in your browser.</div></noscript>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
