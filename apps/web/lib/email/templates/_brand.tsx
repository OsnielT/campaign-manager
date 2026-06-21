import { Img, Section, Text } from "@react-email/components";
import * as React from "react";

// Email-safe brand lockup. Email clients (Gmail/Outlook) don't render SVG or
// external CSS, so we use a PNG referenced by an absolute URL plus a text
// wordmark with inline styles only.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.dev").replace(/\/$/, "");
const LOGO_SRC = `${APP_URL}/icon-192.png`;

export const BRAND_NAME = "Stemflow";

export function EmailBrand() {
  return (
    <Section style={logoSection}>
      <Img src={LOGO_SRC} width="28" height="28" alt={BRAND_NAME} style={logoMark} />
      <Text style={logoText}>{BRAND_NAME}</Text>
    </Section>
  );
}

const logoSection: React.CSSProperties = {
  marginBottom: "4px",
};

const logoMark: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  display: "inline-block",
  verticalAlign: "middle",
  marginRight: "10px",
};

const logoText: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: "16px",
  fontWeight: "700",
  letterSpacing: "-0.3px",
  margin: "0",
  display: "inline-block",
  verticalAlign: "middle",
};
