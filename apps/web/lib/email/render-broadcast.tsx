// Renders an EmailDesign to email-client-safe HTML via React Email, themed by
// the campaign branding. The template keeps {{merge}} tags intact; callers
// apply per-recipient values with applyMergeTags (lib/email/design.ts).

import * as React from "react";
import {
  Html, Head, Preview, Body, Container, Section, Heading, Text, Button, Img, Hr, Link,
} from "@react-email/components";
import { render } from "@react-email/render";
import { resolveFontFamily, type CampaignTheme } from "@/lib/campaign-engine/theme";
import type { EmailBlock, EmailDesign } from "@/lib/email/design";
import { sanitizeRichText } from "@/lib/sanitize";

interface Palette {
  pageBg: string; containerBg: string; text: string; accent: string; border: string; muted: string; font: string;
}

function palette(theme: CampaignTheme | null): Palette {
  return {
    pageBg: theme?.bgColor || "#f4f5f8",
    containerBg: theme?.surfaceColor || "#ffffff",
    text: theme?.textColor || "#1f2937",
    accent: theme?.accentColor || "#4f46e5",
    border: theme?.borderColor || "#e5e7eb",
    muted: "#6b7280",
    font: resolveFontFamily(theme?.fontFamily ?? null) || "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  };
}

const str = (v: unknown, d = "") => (typeof v === "string" && v.trim() ? v : d);

function BlockView({ block, p }: { block: EmailBlock; p: Palette }) {
  const props = block.props || {};
  const align = (str(props.align, "left") as React.CSSProperties["textAlign"]);
  switch (block.type) {
    case "logo": {
      const img = str(props.imageUrl);
      return (
        <Section style={{ padding: "8px 24px 0", textAlign: str(props.align, "center") as React.CSSProperties["textAlign"] }}>
          {img ? (
            <Img src={img} height={str(props.height, "36")} alt="logo" style={{ display: "inline-block" }} />
          ) : (
            <Text style={{ margin: 0, fontWeight: 700, fontSize: 16, letterSpacing: "0.12em", textTransform: "uppercase", color: str(props.color, p.text) }}>
              {str(props.text, "BRAND")}
            </Text>
          )}
        </Section>
      );
    }
    case "image": {
      const src = str(props.src);
      if (!src) return <Section style={{ padding: "8px 24px", textAlign: align }}><Text style={{ color: p.muted, fontSize: 13 }}>Image not set</Text></Section>;
      const el = <Img src={src} alt={str(props.alt)} width={str(props.width, "100%")} style={{ borderRadius: str(props.borderRadius, "8px"), maxWidth: "100%", display: "inline-block" }} />;
      return <Section style={{ padding: "12px 24px", textAlign: str(props.align, "center") as React.CSSProperties["textAlign"] }}>{str(props.href) ? <Link href={str(props.href)}>{el}</Link> : el}</Section>;
    }
    case "heading":
      return (
        <Section style={{ padding: "4px 24px" }}>
          <Heading as={(str(props.level, "h1") as "h1" | "h2")} style={{ margin: "8px 0", color: str(props.color, p.text), fontSize: str(props.fontSize, "26px"), textAlign: align, lineHeight: 1.25 }}>
            {str(props.text, "Headline")}
          </Heading>
        </Section>
      );
    case "text":
      return (
        <Section style={{ padding: "4px 24px" }}>
          <div
            style={{ color: str(props.color, p.text), fontSize: str(props.fontSize, "15px"), lineHeight: 1.6, textAlign: align }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(str(props.html, "")) }}
          />
        </Section>
      );
    case "button":
      return (
        <Section style={{ padding: "14px 24px", textAlign: align }}>
          <Button href={str(props.href, "#")} style={{ background: str(props.bg, p.accent), color: str(props.color, "#ffffff"), borderRadius: str(props.radius, "8px"), padding: "12px 22px", fontSize: 15, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
            {str(props.label, "Click")}
          </Button>
        </Section>
      );
    case "divider":
      return <Section style={{ padding: `${str(props.paddingY, "16px")} 24px` }}><Hr style={{ borderColor: str(props.color, p.border), margin: 0 }} /></Section>;
    case "spacer":
      return <Section style={{ height: str(props.height, "24px"), lineHeight: str(props.height, "24px"), fontSize: 1 }}>&nbsp;</Section>;
    case "footer":
      return (
        <Section style={{ padding: "20px 24px 8px" }}>
          <Hr style={{ borderColor: p.border, marginBottom: 14 }} />
          <Text style={{ margin: 0, color: str(props.color, p.muted), fontSize: 12, lineHeight: 1.6, textAlign: "center" }}>
            {str(props.text, "")}
            {props.showUnsubscribe ? <><br /><Link href="{{unsubscribe_url}}" style={{ color: p.muted, textDecoration: "underline" }}>Unsubscribe</Link></> : null}
          </Text>
        </Section>
      );
    default:
      return null;
  }
}

export function BroadcastEmail({ design, theme, preheader }: { design: EmailDesign; theme: CampaignTheme | null; preheader?: string }) {
  const p = palette(theme);
  const blocks = design?.blocks ?? [];
  return (
    <Html lang="en">
      <Head />
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={{ background: p.pageBg, margin: 0, padding: "24px 0", fontFamily: p.font }}>
        <Container style={{ background: p.containerBg, borderRadius: 12, maxWidth: 600, margin: "0 auto", overflow: "hidden", border: `1px solid ${p.border}` }}>
          {blocks.map((b) => <BlockView key={b.id} block={b} p={p} />)}
        </Container>
      </Body>
    </Html>
  );
}

/** Render the design to HTML (with merge tags intact). */
export async function renderBroadcastHtml(design: EmailDesign, theme: CampaignTheme | null, preheader?: string): Promise<string> {
  return render(<BroadcastEmail design={design} theme={theme} preheader={preheader} />, { pretty: false });
}
