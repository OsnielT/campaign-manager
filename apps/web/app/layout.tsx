import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Stemflow | Multi-Step Marketing Campaign Builder",
    template: "%s | Stemflow",
  },

  description:
    "Stemflow helps teams build, publish, and track multi-step marketing campaigns with conditional page flows, audience targeting, email broadcasts, and conversion tracking.",

  keywords: [
    "Stemflow",
    "marketing campaign builder",
    "multi-step campaigns",
    "campaign editor",
    "landing page builder",
    "conditional flows",
    "audience targeting",
    "email broadcasts",
    "conversion tracking",
    "marketing automation",
  ],

  authors: [{ name: "Stemflow" }],
  creator: "Stemflow",
  publisher: "Stemflow",

  alternates: {
    canonical: "/",
  },

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },

  manifest: "/site.webmanifest",

  openGraph: {
    type: "website",
    siteName: "Stemflow",
    title: "Stemflow | Multi-Step Marketing Campaign Builder",
    description:
      "Build, publish, and track multi-step marketing campaigns with conditional page flows, audience targeting, email broadcasts, and conversion tracking.",
    url: siteUrl,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Stemflow multi-step marketing campaign builder interface",
      },
    ],
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Stemflow | Multi-Step Marketing Campaign Builder",
    description:
      "Build, publish, and track multi-step marketing campaigns with conditional page flows, audience targeting, email broadcasts, and conversion tracking.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  applicationName: "Stemflow",

  category: "Marketing",

  themeColor: "#3525CD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}