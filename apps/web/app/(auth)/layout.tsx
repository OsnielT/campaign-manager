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

const animatedLogo: React.CSSProperties = {
  width: "160px",
  height: "32px",

  background:
    "linear-gradient(90deg, #3525cd, #7c5af3, #00d4ff, #a78bfa, #3525cd)",
  backgroundSize: "300% 100%",

  maskImage: 'url("/stemflow-logo-bw.svg")',
  maskRepeat: "no-repeat",
  maskPosition: "center",
  maskSize: "contain",

  WebkitMaskImage: 'url("/stemflow-logo-bw.svg")',
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  WebkitMaskSize: "contain",

  animation: "stemflowGradientMove 4s ease-in-out infinite",
};