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

interface InviteProps {
  inviteUrl: string;
  orgName: string;
  inviterName: string;
  role: string;
}

export function InviteTemplate({ inviteUrl, orgName, inviterName, role }: InviteProps) {
  const roleLabel = role === "editor" ? "an Editor" : "a Viewer";

  return (
    <Html lang="en">
      <Head />
      <Preview>{inviterName} invited you to join {orgName} on Primitive</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoMark} />
            <Text style={logoText}>Primitive</Text>
          </Section>

          <Hr style={divider} />

          <Text style={heading}>You're invited to join {orgName}</Text>

          <Text style={paragraph}>
            <strong style={{ color: "#e2e8f0" }}>{inviterName}</strong> has invited you to join{" "}
            <strong style={{ color: "#e2e8f0" }}>{orgName}</strong> on Primitive as{" "}
            {roleLabel}.
          </Text>

          <Text style={paragraph}>
            As {roleLabel.toLowerCase()} you'll be able to{" "}
            {role === "editor"
              ? "create and edit campaigns, manage audience lists, and view conversions."
              : "view campaigns and conversion reports."}
          </Text>

          <Section style={buttonWrap}>
            <Button href={inviteUrl} style={button}>
              Accept invitation
            </Button>
          </Section>

          <Hr style={divider} />

          <Text style={footer}>
            This invitation expires in 7 days. If you weren't expecting this invitation,
            you can safely ignore this email.
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

const logoSection: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "4px",
};

const logoMark: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  background: "linear-gradient(135deg, #7c5af3, #a78bfa)",
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

const footer: React.CSSProperties = {
  color: "#334155",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0",
};
