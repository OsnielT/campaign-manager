import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Primitive", template: "%s | Primitive" },
  description: "Build, publish, and track campaign microsites.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
