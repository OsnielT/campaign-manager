import Link from "next/link";
import StemflowLogo from "@/components/branding/StemflowLogo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={shell}>
      <div style={logoWrapper}>
        <Link href="/" style={{ display: "flex" }}>
          <StemflowLogo width={130} />
        </Link>
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
  );
}

const shell: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "24px",
  padding: "24px",
  background:
    "radial-gradient(ellipse at 50% 0%, #7c5af310 0%, transparent 70%), var(--bg)",
};

const logoWrapper: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const legalLinks: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
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
