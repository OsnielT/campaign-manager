import type React from "react";

export type DensityStyle = "compact" | "comfortable" | "spacious";

export interface CampaignTheme {
  accentColor: string | null;
  bgColor: string | null;
  surfaceColor: string | null;
  textColor: string | null;
  borderColor: string | null;
  headingFont: string | null;
  fontFamily: string | null;
  radiusStyle: "sharp" | "default" | "rounded" | null;
  density: DensityStyle | null;
  logoUrl: string | null;
}

export const DEFAULT_THEME: CampaignTheme = {
  accentColor: null,
  bgColor: null,
  surfaceColor: null,
  textColor: null,
  borderColor: null,
  headingFont: null,
  fontFamily: null,
  radiusStyle: null,
  density: null,
  logoUrl: null,
};

/** Spacing scale per density — section padding, content width, and grid/stack gap. */
export const DENSITY_MAP: Record<DensityStyle, { paddingY: string; contentWidth: string; gap: string }> = {
  compact:     { paddingY: "30px", contentWidth: "680px", gap: "10px" },
  comfortable: { paddingY: "48px", contentWidth: "760px", gap: "16px" },
  spacious:    { paddingY: "72px", contentWidth: "840px", gap: "24px" },
};

/**
 * Default brand seeded onto new organizations — a clean, neutral light look.
 * Campaigns inherit these unless they override a field, and designed templates
 * set their own (usually dark) theme on top.
 */
export const NEUTRAL_LIGHT_BRAND: CampaignTheme = {
  accentColor: "#4f46e5",
  bgColor: "#ffffff",
  surfaceColor: "#f5f6f8",
  textColor: "#18181b",
  borderColor: "#e4e4e7",
  headingFont: "serif",
  fontFamily: "inter",
  radiusStyle: "default",
  density: "comfortable",
  logoUrl: null,
};

/**
 * Resolve the effective brand for a campaign by layering its theme over the
 * org branding, field by field: `campaign ?? org ?? null`. The result feeds
 * `buildThemeVars` (and the editor), so every element reads one resolved value.
 */
export function resolveBrand(
  org: CampaignTheme | null | undefined,
  campaign: CampaignTheme | null | undefined,
): CampaignTheme {
  const pick = <K extends keyof CampaignTheme>(k: K): CampaignTheme[K] =>
    (campaign?.[k] ?? org?.[k] ?? null) as CampaignTheme[K];
  return {
    accentColor: pick("accentColor"),
    bgColor: pick("bgColor"),
    surfaceColor: pick("surfaceColor"),
    textColor: pick("textColor"),
    borderColor: pick("borderColor"),
    headingFont: pick("headingFont"),
    fontFamily: pick("fontFamily"),
    radiusStyle: pick("radiusStyle"),
    density: pick("density"),
    logoUrl: pick("logoUrl"),
  };
}

export const FONT_OPTIONS = [
  { key: "system",       label: "System UI",          family: "system-ui, sans-serif",                          googleFont: null },
  { key: "dm-sans",      label: "DM Sans",             family: "'DM Sans', system-ui, sans-serif",               googleFont: "DM+Sans:wght@300;400;500;600" },
  { key: "inter",        label: "Inter",               family: "'Inter', system-ui, sans-serif",                 googleFont: "Inter:wght@400;500;600" },
  { key: "plus-jakarta", label: "Plus Jakarta Sans",   family: "'Plus Jakarta Sans', sans-serif",                googleFont: "Plus+Jakarta+Sans:wght@400;500;600" },
  { key: "outfit",       label: "Outfit",              family: "'Outfit', system-ui, sans-serif",                googleFont: "Outfit:wght@400;500;600" },
  { key: "geist",        label: "Geist",               family: "'Geist', system-ui, sans-serif",                 googleFont: "Geist:wght@400;500;600" },
] as const;

export type FontKey = typeof FONT_OPTIONS[number]["key"];

export const HEADING_FONT_OPTIONS = [
  { key: "serif",       label: "System Serif",        family: "Georgia, 'Times New Roman', serif",               googleFont: null },
  { key: "cormorant",   label: "Cormorant Garamond",  family: "'Cormorant Garamond', Georgia, serif",            googleFont: "Cormorant+Garamond:wght@400;600;700" },
  { key: "playfair",    label: "Playfair Display",    family: "'Playfair Display', Georgia, serif",              googleFont: "Playfair+Display:wght@400;600;700" },
  { key: "dm-serif",    label: "DM Serif Display",    family: "'DM Serif Display', Georgia, serif",              googleFont: "DM+Serif+Display:ital@0;1" },
  { key: "fraunces",    label: "Fraunces",            family: "'Fraunces', Georgia, serif",                      googleFont: "Fraunces:wght@400;600;700" },
  { key: "libre-bodoni", label: "Libre Bodoni",       family: "'Libre Bodoni', Georgia, serif",                  googleFont: "Libre+Bodoni:wght@400;700" },
] as const;

export type HeadingFontKey = typeof HEADING_FONT_OPTIONS[number]["key"];

export function resolveHeadingFontFamily(key: string | null): string | undefined {
  if (!key) return undefined;
  return HEADING_FONT_OPTIONS.find((f) => f.key === key)?.family;
}

export function getHeadingFontGoogleParam(key: string | null): string | null {
  if (!key) return null;
  return HEADING_FONT_OPTIONS.find((f) => f.key === key)?.googleFont ?? null;
}

export function getFontGoogleParam(key: string | null): string | null {
  if (!key) return null;
  return FONT_OPTIONS.find((f) => f.key === key)?.googleFont ?? null;
}

const RADIUS_MAP = {
  sharp:   { sm: "0px",  md: "2px",  pill: "4px"  },
  default: { sm: "4px",  md: "8px",  pill: "999px" },
  rounded: { sm: "12px", md: "20px", pill: "999px" },
};

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
}

function lightenHex(hex: string, amount: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (
    "#" +
    clamp(r + amount).toString(16).padStart(2, "0") +
    clamp(g + amount).toString(16).padStart(2, "0") +
    clamp(b + amount).toString(16).padStart(2, "0")
  );
}

export function buildThemeVars(theme: CampaignTheme): React.CSSProperties {
  const vars: Record<string, string> = {};

  if (theme.accentColor) {
    vars["--primitive-action-background"]      = theme.accentColor;
    vars["--primitive-action-backgroundHover"] = lightenHex(theme.accentColor, 20);
    vars["--primitive-action-foreground"]      = "#ffffff";
    vars["--primitive-border-action"]          = theme.accentColor;
    vars["--primitive-text-action"]            = theme.accentColor;
    vars["--primitive-surface-action"]         = hexWithAlpha(theme.accentColor, 0.09);
    vars["--campaign-accent"]                  = theme.accentColor;
  }

  if (theme.bgColor) {
    vars["--primitive-surface-canvas"] = theme.bgColor;
    vars["--campaign-bg"]              = theme.bgColor;
  }

  if (theme.surfaceColor) {
    vars["--primitive-surface-subtle"] = theme.surfaceColor;
    vars["--primitive-surface-sunken"] = theme.surfaceColor;
    vars["--campaign-surface"]         = theme.surfaceColor;
  }

  if (theme.textColor) {
    vars["--primitive-text-primary"]   = theme.textColor;
    vars["--primitive-text-secondary"] = hexWithAlpha(theme.textColor, 0.7);
    vars["--campaign-text"]            = theme.textColor;
  }

  if (theme.borderColor) {
    vars["--campaign-border"] = theme.borderColor;
  }

  if (theme.radiusStyle && theme.radiusStyle !== "default") {
    const r = RADIUS_MAP[theme.radiusStyle];
    vars["--primitive-radius-sm"]   = r.sm;
    vars["--primitive-radius-md"]   = r.md;
    vars["--primitive-radius-pill"] = r.pill;
  }

  if (theme.fontFamily) {
    const font = FONT_OPTIONS.find((f) => f.key === theme.fontFamily);
    if (font) {
      vars["--primitive-typography-family-base"] = font.family;
      vars["--campaign-body-font"]               = font.family;
    }
  }

  if (theme.headingFont) {
    const hf = HEADING_FONT_OPTIONS.find((f) => f.key === theme.headingFont);
    if (hf) vars["--campaign-heading-font"] = hf.family;
  }

  if (theme.density) {
    const d = DENSITY_MAP[theme.density];
    vars["--campaign-section-padding-y"] = d.paddingY;
    vars["--campaign-content-width"]     = d.contentWidth;
    vars["--campaign-gap"]               = d.gap;
  }

  return vars as React.CSSProperties;
}

/** Returns the resolved font-family CSS value for a given font key, or undefined. */
export function resolveFontFamily(key: string | null): string | undefined {
  if (!key) return undefined;
  return FONT_OPTIONS.find((f) => f.key === key)?.family;
}
