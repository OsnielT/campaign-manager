import Link from "next/link";
import StemflowLogo from "@/components/branding/StemflowLogo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={shell}>
      <div style={card}>
        <div style={logoWrapper}>
         <StemflowLogo width={130} />
        </div>

        {children}

        <div style={legalLinks}>
          <Link href="/privacy" style={legalLink}>Privacy</Link>
          <span style={legalDot} aria-hidden>·</span>
          <Link href="/terms" style={legalLink}>Terms</Link>
          <span style={legalDot} aria-hidden>·</span>
          <Link href="/cookies" style={legalLink}>Cookies</Link>
        </div>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background:
    "radial-gradient(ellipse at 50% 0%, #7c5af310 0%, transparent 70%), var(--bg)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: "400px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "36px 32px",
  boxShadow: "var(--shadow)",
};

const logoWrapper: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: "32px",
};

const legalLinks: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  marginTop: "24px",
};

const legalLink: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  textDecoration: "none",
};

const legalDot: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
};
