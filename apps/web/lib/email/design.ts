// Email broadcast design model — a flat stack of blocks rendered to
// email-client-safe HTML by render-broadcast.tsx. Shared by the editor, the
// preview route, and the send engine.

import type { CampaignTheme } from "@/lib/campaign-engine/theme";

/** Theme keys an email can override (colors only — fonts/density inherit). */
export const EMAIL_THEME_KEYS = ["bgColor", "surfaceColor", "textColor", "accentColor", "borderColor"] as const;

/** Merge a broadcast's theme override onto the resolved campaign brand. */
export function applyThemeOverride(base: CampaignTheme, override: Partial<CampaignTheme> | null | undefined): CampaignTheme {
  if (!override) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out as unknown as CampaignTheme;
}

export type EmailBlockType =
  | "logo"
  | "image"
  | "heading"
  | "text"
  | "button"
  | "divider"
  | "spacer"
  | "footer";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  props: Record<string, unknown>;
}

export interface EmailDesign {
  blocks: EmailBlock[];
}

export const BLOCK_LABELS: Record<EmailBlockType, string> = {
  logo: "Logo",
  image: "Image",
  heading: "Heading",
  text: "Text",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  footer: "Footer",
};

export const BLOCK_ORDER: EmailBlockType[] = [
  "logo", "heading", "text", "image", "button", "divider", "spacer", "footer",
];

let n = 0;
export function newBlockId(prefix: string): string {
  n += 1;
  return `${prefix}-${Date.now().toString(36)}${n}`;
}

export function blockDefaults(type: EmailBlockType): Record<string, unknown> {
  switch (type) {
    case "logo":
      return { text: "BRAND", imageUrl: "", height: "36px", align: "center", color: "" };
    case "image":
      return { src: "", alt: "", width: "100%", align: "center", borderRadius: "8px", href: "" };
    case "heading":
      return { text: "Your headline here", level: "h1", align: "left", color: "", fontSize: "26px" };
    case "text":
      return { html: "<p>Write your message here. Use {{name}} to personalize.</p>", align: "left", color: "", fontSize: "15px" };
    case "button":
      return { label: "Call to action", href: "https://", bg: "", color: "#ffffff", radius: "8px", align: "left" };
    case "divider":
      return { color: "", paddingY: "16px" };
    case "spacer":
      return { height: "24px" };
    case "footer":
      return { text: "You're receiving this because you signed up.", color: "", showUnsubscribe: true };
    default:
      return {};
  }
}

export function createBlock(type: EmailBlockType): EmailBlock {
  return { id: newBlockId(type), type, props: blockDefaults(type) };
}

/** Starter design for a new broadcast. */
export function defaultDesign(): EmailDesign {
  return {
    blocks: [
      createBlock("logo"),
      createBlock("heading"),
      createBlock("text"),
      createBlock("button"),
      createBlock("footer"),
    ],
  };
}

/**
 * Replace merge tags in an email string.
 * Supports both legacy shorthand {{name}} and full {{record.field|transform|fallback}} syntax.
 * Missing keys → empty string (or fallback if specified).
 */
export function applyMergeTags(input: string, values: Record<string, string>): string {
  // Build a minimal InterpolationContext from the flat values map.
  // All values live under `record` so {{name}} (shorthand) and {{record.name}} both resolve.
  const ctx = {
    record: values as Record<string, unknown>,
    form:   {} as Record<string, unknown>,
    url:    {} as Record<string, string>,
    context: {} as Record<string, unknown>,
  };

  const TRANSFORMS = new Set(["capitalize", "uppercase", "lowercase"]);
  return (input || "").replace(/\{\{([^}]+)\}\}/g, (_match, inner: string) => {
    const parts = inner.trim().split("|");
    const spec = parts[0].trim();

    let field: string;
    if (spec.includes(".")) {
      // {{source.field}} — strip the source prefix and look up in the flat values map
      field = spec.slice(spec.indexOf(".") + 1);
    } else {
      field = spec;
    }

    let fallback: string | undefined;
    const transforms: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i].trim();
      if (TRANSFORMS.has(seg)) transforms.push(seg);
      else fallback = seg;
    }

    const raw = ctx.record[field] ?? ctx.record[spec];
    if (raw == null || raw === "") return fallback ?? "";

    let value = String(raw);
    for (const t of transforms) {
      if (t === "capitalize") value = value.charAt(0).toUpperCase() + value.slice(1);
      else if (t === "uppercase") value = value.toUpperCase();
      else if (t === "lowercase") value = value.toLowerCase();
    }
    return value;
  });
}

/** Build the merge-tag value map for a recipient. */
export function mergeValuesFor(
  name: string | null,
  email: string,
  fields: Record<string, unknown>,
  unsubscribeUrl?: string,
): Record<string, string> {
  const out: Record<string, string> = { name: name ?? "", email };
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = v == null ? "" : String(v);
  if (unsubscribeUrl) out.unsubscribe_url = unsubscribeUrl;
  return out;
}
