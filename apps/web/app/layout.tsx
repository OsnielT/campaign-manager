import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
export const metadata: Metadata = {
  title: { default: "Stemflow", template: "%s | Stemflow" },
  description: "Build, publish, and track multi-step marketing campaigns. Drag-and-drop page builder, conditional flow engine, email broadcasts, and conversion tracking — all in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.io"),
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
    title: "Stemflow",
    description: "Build, publish, and track multi-step marketing campaigns.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stemflow",
    description: "Build, publish, and track multi-step marketing campaigns.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Analytics />
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
