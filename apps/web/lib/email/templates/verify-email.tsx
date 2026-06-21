import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { EmailBrand } from "./_brand";

interface VerifyEmailProps {
  verificationUrl: string;
  userName: string;
}

export function VerifyEmailTemplate({ verificationUrl, userName }: VerifyEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your email to activate your Stemflow account</Preview>
      <Body style={body}>
        <Container style={container}>
          <EmailBrand />

          <Hr style={divider} />

          <Text style={heading}>Confirm your email address</Text>

          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            Thanks for creating a Stemflow account. Click the button below to verify your email
            address — the link expires in <strong style={{ color: "#e2e8f0" }}>24 hours</strong>.
          </Text>

          <Section style={buttonWrap}>
            <Button href={verificationUrl} style={button}>
              Verify email address
            </Button>
          </Section>

          <Text style={hint}>
            Or copy and paste this URL into your browser:
          </Text>
          <Text style={urlText}>{verificationUrl}</Text>

          <Hr style={divider} />
          <Text style={footer}>
            If you didn't create a Stemflow account, you can safely ignore this email. No account will be created.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#080810",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "40px 0",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "36px 40px",
  maxWidth: "520px",
  backgroundColor: "#0f0f1a",
  borderRadius: "12px",
  border: "1px solid #1e1e2e",
};

const divider: React.CSSProperties = {
  borderColor: "#1e1e2e",
  margin: "24px 0",
};

const heading: React.CSSProperties = {
  color: "#f1f5f9",
  fontSize: "22px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
  margin: "0 0 20px",
  lineHeight: "1.3",
};

const paragraph: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 14px",
};

const buttonWrap: React.CSSProperties = {
  margin: "28px 0",
  textAlign: "center",
};

const button: React.CSSProperties = {
  backgroundColor: "#7c5af3",
  color: "#ffffff",
  padding: "13px 28px",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  display: "inline-block",
  letterSpacing: "-0.1px",
};

const hint: React.CSSProperties = {
  color: "#475569",
  fontSize: "12px",
  margin: "0 0 6px",
};

const urlText: React.CSSProperties = {
  color: "#7c5af3",
  fontSize: "12px",
  wordBreak: "break-all",
  margin: "0 0 20px",
};

const footer: React.CSSProperties = {
  color: "#334155",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0",
};
