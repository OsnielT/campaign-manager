import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={shell}>
      <div style={card}>
        <div style={logo}>
          <span style={logoMark} />
          <span style={logoText}>Primitive</span>
        </div>
        {children}
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
  background: "radial-gradient(ellipse at 50% 0%, #7c5af310 0%, transparent 70%), var(--bg)",
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

const logo: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "32px",
};

const logoMark: React.CSSProperties = {
  display: "inline-block",
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  background: "linear-gradient(135deg, #7c5af3, #a78bfa)",
};

const logoText: React.CSSProperties = {
  fontSize: "17px",
  fontWeight: "600",
  color: "var(--text-primary)",
  letterSpacing: "-0.3px",
};
