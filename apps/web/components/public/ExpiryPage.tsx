import React from "react";
import { PrimitiveRenderer, type RendererContext } from "./PrimitiveRenderer";

interface ExpiryPageProps {
  campaignName: string;
  expiryPageTree: unknown | null;
  ctx: RendererContext;
}

export function ExpiryPage({ campaignName, expiryPageTree, ctx }: ExpiryPageProps) {
  if (expiryPageTree) {
    return <PrimitiveRenderer data={expiryPageTree as Parameters<typeof PrimitiveRenderer>[0]["data"]} ctx={ctx} />;
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={iconWrap}>
          <span style={icon}>◷</span>
        </div>
        <h1 style={heading}>This campaign has ended</h1>
        <p style={sub}>
          <strong>{campaignName}</strong> is no longer accepting responses.
        </p>
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
  background: "#0c0c0e",
};
const card: React.CSSProperties = {
  textAlign: "center",
  maxWidth: "420px",
  padding: "48px 32px",
  background: "#111114",
  border: "1px solid #27272d",
  borderRadius: "16px",
};
const iconWrap: React.CSSProperties = { marginBottom: "20px" };
const icon: React.CSSProperties = { fontSize: "40px", opacity: 0.3 };
const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "600",
  color: "#f0f0f5",
  letterSpacing: "-0.3px",
  marginBottom: "10px",
};
const sub: React.CSSProperties = { fontSize: "14px", color: "#8b8b9a", lineHeight: "1.6" };
