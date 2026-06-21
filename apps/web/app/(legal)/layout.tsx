import Link from "next/link";
import StemflowLogo from "@/components/branding/StemflowLogo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: { template: "%s — Stemflow", default: "Legal" } };

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={shell}>
      <header style={header}>
        <div style={headerInner}>
          <Link href="/" aria-label="Back to home">
            <StemflowLogo width={110} />
          </Link>
          <nav aria-label="Legal pages" style={nav}>
            <Link href="/privacy" style={navLink}>Privacy</Link>
            <Link href="/terms" style={navLink}>Terms</Link>
            <Link href="/cookies" style={navLink}>Cookies</Link>
          </nav>
        </div>
      </header>

      <main id="main" style={main}>
        <div style={prose}>{children}</div>
      </main>

      <footer style={footer}>
        <div style={footerInner}>
          <span style={footerText}>© {new Date().getFullYear()} Stemflow</span>
          <div style={footerLinks}>
            <Link href="/privacy" style={footerLink}>Privacy</Link>
            <Link href="/terms" style={footerLink}>Terms</Link>
            <Link href="/cookies" style={footerLink}>Cookies</Link>
            <Link href="/" style={footerLink}>Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg)",
  color: "var(--text-primary)",
};

const header: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-surface)",
};

const headerInner: React.CSSProperties = {
  maxWidth: "780px",
  margin: "0 auto",
  padding: "16px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const nav: React.CSSProperties = { display: "flex", gap: "20px" };

const navLink: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  textDecoration: "none",
  fontWeight: 500,
};

const main: React.CSSProperties = {
  flex: 1,
  padding: "48px 24px 80px",
};

const prose: React.CSSProperties = {
  maxWidth: "780px",
  margin: "0 auto",
  lineHeight: 1.75,
};

const footer: React.CSSProperties = {
  borderTop: "1px solid var(--border)",
  padding: "20px 24px",
  background: "var(--bg-surface)",
};

const footerInner: React.CSSProperties = {
  maxWidth: "780px",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
};

const footerLinks: React.CSSProperties = { display: "flex", gap: "16px" };

const footerLink: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  textDecoration: "none",
};
