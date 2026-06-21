"use client";

import React from "react";
import { DropZone } from "@measured/puck";
import type { DefaultComponentProps, Fields } from "@measured/puck";
import {
  Navigation,
  Image as HeroIcon,
  LayoutPanelTop,
  LayoutGrid,
  CreditCard,
  ListChecks,
  Minus,
  ListOrdered,
  CheckCircle2,
  PanelBottom,
} from "lucide-react";
import { useCampaignTheme, computeCampaignStyles } from "@/lib/builder/campaign-theme-context";
import {
  colorField as colorCssField,
  alignField,
  radiusField,
  dimensionField,
  spacingField,
  spacingToCss,
  SPACING_ZERO,
  customCssField,
  sectionField,
  imageField,
  omitFields,
  parseCustomCss,
  type SpacingValue,
} from "@/lib/builder/inspector-fields";

// ─── Local field helpers ──────────────────────────────────────────────────────
// Modern Inspector controls are imported from inspector-fields.tsx above.

function useCampaignStyles() {
  return computeCampaignStyles(useCampaignTheme());
}

// ─── Checkmark SVG icon ───────────────────────────────────────────────────────

function CheckIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M2 7.5L5.5 11L12 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="8.25" stroke={color} strokeWidth="1.5" />
      <path d="M5 9.5L7.5 12L13 6.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SuccessCheckIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 16.5L12 22.5L26 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── 1. CampaignNav ───────────────────────────────────────────────────────────

export interface CampaignNavProps {
  logoText?: string;
  badgeText?: string;
  fontImportUrl?: string;
  background?: string;
  borderColor?: string;
  logoColor?: string;
  logotype?: "serif" | "sans";
  logoLetterSpacing?: string;
  badgeBackground?: string;
  badgeTextColor?: string;
  className?: string;
  customCss?: string;
}

export function CampaignNav({
  logoText = "BRAND",
  badgeText = "Campaign",
  fontImportUrl,
  background = "",
  borderColor = "",
  logoColor = "",
  logotype = "serif",
  logoLetterSpacing = "5px",
  badgeBackground = "",
  badgeTextColor = "",
  className,
  customCss = "",
}: CampaignNavProps) {
  const resolvedBg = background || "var(--campaign-bg, rgba(7,7,26,0.95))";
  const resolvedBorder = borderColor || "var(--campaign-border, rgba(255,255,255,0.06))";
  const resolvedBadgeBg = badgeBackground || "var(--campaign-surface, rgba(232,184,75,0.12))";
  const resolvedBadgeText = badgeTextColor || "var(--campaign-accent, #e8b84b)";
  const logoFont = logotype === "serif" ? "var(--campaign-heading-font, Georgia, 'Times New Roman', serif)" : "var(--campaign-body-font, system-ui, sans-serif)";
  const extra = parseCustomCss(customCss);

  return (
    <nav
      className={className}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        background: resolvedBg,
        borderBottom: `1px solid ${resolvedBorder}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        ...extra,
      }}
    >
      {fontImportUrl && (
        <style>{`@import url('${fontImportUrl}');`}</style>
      )}
      <span style={{
        fontFamily: logoFont,
        color: logoColor || "var(--campaign-text, #ffffff)",
        letterSpacing: logoLetterSpacing,
        fontSize: 15,
        fontWeight: 600,
        textTransform: "uppercase" as const,
      }}>
        {logoText}
      </span>
      {badgeText && (
        <span style={{
          background: resolvedBadgeBg,
          color: resolvedBadgeText,
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          border: `1px solid ${resolvedBadgeText}30`,
        }}>
          {badgeText}
        </span>
      )}
    </nav>
  );
}

// ─── 2. Hero ──────────────────────────────────────────────────────────────────

export interface HeroProps {
  backgroundImage?: string;
  imageFilter?: string;
  overlayGradient?: "diagonal" | "to-bottom" | "none";
  overlayColor?: string;
  height?: string;
  textAlign?: "left" | "center";
  contentPosition?: "bottom-left" | "center" | "bottom-center";
  paddingLeft?: string;
  paddingBottom?: string;
  className?: string;
  customCss?: string;
  /** Editable content regions (selectable child nodes) */
  eyebrowSlot?: React.ReactNode;
  headlineSlot?: React.ReactNode;
  subheadlineSlot?: React.ReactNode;
}

export function Hero({
  backgroundImage,
  imageFilter = "brightness(0.35) saturate(0.6)",
  overlayGradient = "diagonal",
  overlayColor,
  height = "340px",
  textAlign = "left",
  contentPosition = "bottom-left",
  paddingLeft = "56px",
  paddingBottom = "48px",
  className,
  customCss = "",
  eyebrowSlot,
  headlineSlot,
  subheadlineSlot,
}: HeroProps) {
  const extra = parseCustomCss(customCss);

  const gradientCss =
    overlayGradient === "diagonal"
      ? "linear-gradient(135deg, rgba(7,7,26,0.85) 0%, rgba(7,7,26,0.3) 60%, transparent 100%)"
      : overlayGradient === "to-bottom"
      ? "linear-gradient(to bottom, transparent 0%, rgba(7,7,26,0.9) 100%)"
      : "none";

  const contentPos: React.CSSProperties =
    contentPosition === "center"
      ? { top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", padding: "0 48px" }
      : contentPosition === "bottom-center"
      ? { bottom: paddingBottom, left: "50%", transform: "translateX(-50%)", textAlign: "center", padding: "0 48px" }
      : { bottom: paddingBottom, left: paddingLeft, textAlign: textAlign as React.CSSProperties["textAlign"] };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height,
        overflow: "hidden",
        ...extra,
      }}
    >
      {backgroundImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImage}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: imageFilter,
          }}
        />
      ) : (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, #0d0d2b 0%, #1a1a3a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Add background image URL →
          </span>
        </div>
      )}
      {overlayGradient !== "none" && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: overlayColor
            ? `linear-gradient(135deg, ${overlayColor} 0%, transparent 70%)`
            : gradientCss,
          pointerEvents: "none",
        }} />
      )}
      <div style={{
        position: "absolute",
        maxWidth: 680,
        color: "#ffffff",
        ...contentPos,
      }}>
        {eyebrowSlot}
        {headlineSlot}
        {subheadlineSlot}
      </div>
    </div>
  );
}

// ─── 3. SectionWrap ───────────────────────────────────────────────────────────

export interface SectionWrapProps {
  maxWidth?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingX?: string;
  background?: string;
  centered?: boolean;
  className?: string;
  customCss?: string;
}

export function SectionWrap({
  maxWidth = "",
  paddingTop = "",
  paddingBottom = "",
  paddingX = "24px",
  background,
  centered = true,
  className,
  customCss = "",
  children,
}: SectionWrapProps & { children?: React.ReactNode }) {
  const extra = parseCustomCss(customCss);
  // Fall back to the brand density tokens when not explicitly set.
  const resolvedMaxWidth = maxWidth || "var(--campaign-content-width, 760px)";
  const resolvedPadY = "var(--campaign-section-padding-y, 48px)";

  return (
    <div
      className={className}
      style={{
        width: "100%",
        background: background ?? undefined,
        ...extra,
      }}
    >
      <div style={{
        maxWidth: resolvedMaxWidth,
        margin: centered ? "0 auto" : undefined,
        paddingTop: paddingTop || resolvedPadY,
        paddingBottom: paddingBottom || resolvedPadY,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        boxSizing: "border-box" as const,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── 4. TierGrid ──────────────────────────────────────────────────────────────

export type GridAlign = "stretch" | "start" | "center" | "end";
export type GridJustify = "stretch" | "start" | "center" | "end" | "space-between";

export interface TierGridProps {
  columns?: "1" | "2" | "3" | "4";
  itemMaxWidth?: string;
  justifyContent?: GridJustify;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
  alignItems?: GridAlign;
  padding?: SpacingValue;
  margin?: SpacingValue;
  className?: string;
  customCss?: string;
}

/** Shared grid style so the editor (DropZone) and public renderer match exactly. */
export function tierGridStyle(p: TierGridProps): React.CSSProperties {
  const cols = parseInt(p.columns || "2", 10) || 2;
  const padCss = spacingToCss(p.padding);
  const marCss = spacingToCss(p.margin);
  // When a max card width is set, cap each track so cards can be narrower than
  // the container; `justifyContent` then distributes/aligns the row of cards.
  const track = p.itemMaxWidth ? `minmax(0, ${p.itemMaxWidth})` : "minmax(0, 1fr)";
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${track})`,
    gap: p.gap || "var(--campaign-gap, 18px)",
    ...(p.rowGap ? { rowGap: p.rowGap } : {}),
    ...(p.columnGap ? { columnGap: p.columnGap } : {}),
    justifyContent: p.justifyContent || "stretch",
    alignItems: p.alignItems || "stretch",
    ...(padCss ? { padding: padCss } : {}),
    ...(marCss ? { margin: marCss } : {}),
    width: "100%",
    ...parseCustomCss(p.customCss || ""),
  };
}

export function TierGrid({
  className,
  children,
  ...rest
}: TierGridProps & { children?: React.ReactNode }) {
  return (
    <div className={className} style={tierGridStyle(rest)}>
      {children}
    </div>
  );
}

// ─── 5. TierCard ──────────────────────────────────────────────────────────────

export interface TierCardFeature { text: string }

export interface TierCardProps {
  tierLabel?: string;
  tierIcon?: "circle" | "star" | "none";
  accentColor?: string;
  featuredLabel?: string;
  topLine?: "left" | "center" | "none";
  background?: string;
  borderColor?: string;
  borderRadius?: string;
  isFeatured?: boolean;
  className?: string;
  customCss?: string;
  headingSlot?: React.ReactNode;
  featuresSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export function TierCard({
  tierLabel = "Tier I",
  tierIcon = "circle",
  accentColor = "",
  featuredLabel,
  topLine = "left",
  background = "",
  borderColor = "",
  borderRadius = "",
  isFeatured = false,
  className,
  customCss = "",
  headingSlot,
  featuresSlot,
  footerSlot,
}: TierCardProps) {
  const extra = parseCustomCss(customCss);
  const accent = accentColor || "var(--campaign-accent, #e8b84b)";
  const border = borderColor || "var(--campaign-border, rgba(255,255,255,0.08))";

  const topLineEl = topLine !== "none" && (
    <div style={{
      height: 2,
      background: accent,
      borderRadius: "2px 2px 0 0",
      width: topLine === "center" ? "40%" : "30%",
      margin: topLine === "center" ? "0 auto" : undefined,
    }} />
  );

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        background: background || "var(--campaign-surface, rgba(255,255,255,0.03))",
        border: `1px solid ${border}`,
        borderRadius: borderRadius || 12,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        ...(isFeatured ? { boxShadow: `0 0 0 1px ${accent}40, 0 8px 32px ${accent}18` } : {}),
        ...extra,
      }}
    >
      {topLineEl}
      <div style={{ padding: "24px 24px 0" }}>
        {/* Tier badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {tierIcon !== "none" && (
            <span style={{
              width: 20,
              height: 20,
              borderRadius: tierIcon === "circle" ? "50%" : 4,
              background: `${accent}20`,
              border: `1px solid ${accent}50`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              {tierIcon === "star" && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill={accent}>
                  <path d="M5 1l1.2 2.6L9 4.1 7 6l.5 2.9L5 7.6 2.5 8.9 3 6 1 4.1l2.8-.5z" />
                </svg>
              )}
            </span>
          )}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: accent,
          }}>
            {tierLabel}
          </span>
        </div>

        {/* Heading slot (title + price) */}
        {headingSlot}

        {/* Features slot */}
        <div style={{ marginTop: 16, marginBottom: 20 }}>{featuresSlot}</div>
      </div>

      {/* Footer slot (CTA + footer text) */}
      {footerSlot && (
        <div style={{ marginTop: "auto", padding: "0 24px 20px" }}>
          {footerSlot}
        </div>
      )}

      {/* Featured label */}
      {featuredLabel && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "6px 0",
          background: accent,
          color: "#07071a",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
        }}>
          {featuredLabel}
        </div>
      )}
    </div>
  );
}

// ─── 6. FeatureList ───────────────────────────────────────────────────────────

export interface FeatureListItem { text: string }

export interface FeatureListProps {
  items?: FeatureListItem[];
  accentColor?: string;
  textColor?: string;
  fontSize?: string;
  iconStyle?: "circle" | "bare";
  size?: "sm" | "md" | "lg";
  gap?: "tight" | "normal" | "loose";
  className?: string;
  customCss?: string;
}

export function FeatureList({
  items = [],
  accentColor = "",
  textColor = "",
  fontSize: fontSizeOverride = "",
  iconStyle = "circle",
  size = "md",
  gap = "normal",
  className,
  customCss = "",
}: FeatureListProps) {
  const extra = parseCustomCss(customCss);
  const accent = accentColor || "var(--campaign-accent, #e8b84b)";
  const gapPx = gap === "tight" ? 8 : gap === "loose" ? 20 : 12;
  const fontSize = fontSizeOverride || (size === "sm" ? 13 : size === "lg" ? 16 : 14);
  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;

  return (
    <ul
      className={className}
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: gapPx,
        ...extra,
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ marginTop: 2, flexShrink: 0 }}>
            {iconStyle === "circle"
              ? <CheckCircleIcon color={accent} size={iconSize} />
              : <CheckIcon color={accent} size={iconSize} />
            }
          </span>
          <span style={{ fontSize, color: textColor || "inherit", lineHeight: 1.45 }}>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── 7. Divider ───────────────────────────────────────────────────────────────

export interface DividerProps {
  label?: string;
  labelColor?: string;
  lineColor?: string;
  paddingY?: string;
  className?: string;
  customCss?: string;
}

export function Divider({
  label,
  labelColor = "",
  lineColor = "",
  paddingY = "36px",
  className,
  customCss = "",
}: DividerProps) {
  const extra = parseCustomCss(customCss);
  const resolvedLine = lineColor || "var(--campaign-border, rgba(255,255,255,0.08))";

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        paddingTop: paddingY,
        paddingBottom: paddingY,
        ...extra,
      }}
    >
      <hr style={{ flex: 1, border: "none", borderTop: `1px solid ${resolvedLine}`, margin: 0 }} />
      {label && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: labelColor || "var(--campaign-text, rgba(255,255,255,0.35))",
          opacity: labelColor ? 1 : 0.5,
          flexShrink: 0,
          whiteSpace: "nowrap" as const,
        }}>
          {label}
        </span>
      )}
      {label && <hr style={{ flex: 1, border: "none", borderTop: `1px solid ${resolvedLine}`, margin: 0 }} />}
    </div>
  );
}

// ─── 8. StepItem ─────────────────────────────────────────────────────────────

export interface StepItemProps {
  icon?: string;
  showIcon?: boolean;
  iconSize?: string;
  iconFontSize?: string;
  iconBackground?: string;
  iconBorderColor?: string;
  iconRadius?: string;
  direction?: "row" | "column";
  align?: "start" | "center" | "stretch";
  gap?: string;
  padding?: SpacingValue;
  margin?: SpacingValue;
  background?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  className?: string;
  customCss?: string;
  titleSlot?: React.ReactNode;
  descriptionSlot?: React.ReactNode;
}

export function StepItem({
  icon = "📬",
  showIcon = true,
  iconSize = "44px",
  iconFontSize = "20px",
  iconBackground = "",
  iconBorderColor = "",
  iconRadius = "",
  direction = "row",
  align = "center",
  gap = "",
  padding,
  margin,
  background = "",
  borderColor = "",
  borderWidth = "",
  borderRadius = "",
  className,
  customCss = "",
  titleSlot,
  descriptionSlot,
}: StepItemProps) {
  const extra = parseCustomCss(customCss);
  const resolvedBg = background || "var(--campaign-surface, rgba(255,255,255,0.03))";
  const resolvedBorder = borderColor || "var(--campaign-border, rgba(255,255,255,0.08))";
  const padCss = spacingToCss(padding);
  const marCss = spacingToCss(margin);
  const alignItems = align === "start" ? "flex-start" : align === "stretch" ? "stretch" : "center";

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems,
        gap: gap || 16,
        padding: padCss || "18px 20px",
        ...(marCss ? { margin: marCss } : {}),
        background: resolvedBg,
        border: `${borderWidth || "1px"} solid ${resolvedBorder}`,
        borderRadius: borderRadius || 10,
        color: "var(--campaign-text, #ffffff)",
        // Fill the cell height so the card matches the live view inside the
        // editor's Puck wrapper (which the grid stretches to equal height).
        height: "100%",
        boxSizing: "border-box",
        ...extra,
      }}
    >
      {showIcon && (
        <div style={{
          flexShrink: 0,
          width: iconSize || 44,
          height: iconSize || 44,
          borderRadius: iconRadius || 10,
          background: iconBackground || "rgba(255,255,255,0.05)",
          border: `1px solid ${iconBorderColor || resolvedBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: iconFontSize || 20,
        }}>
          {icon}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, flex: 1 }}>
        {titleSlot}
        {descriptionSlot}
      </div>
    </div>
  );
}

// ─── 9. SuccessHeader ────────────────────────────────────────────────────────

export interface SuccessHeaderProps {
  iconBackground?: string;
  iconBorderColor?: string;
  iconColor?: string;
  topLine?: boolean;
  glowColor?: string;
  className?: string;
  customCss?: string;
  headlineSlot?: React.ReactNode;
  subheadlineSlot?: React.ReactNode;
}

export function SuccessHeader({
  iconBackground = "rgba(74,222,128,0.1)",
  iconBorderColor = "rgba(74,222,128,0.25)",
  iconColor = "#4ade80",
  topLine = true,
  glowColor,
  className,
  customCss = "",
  headlineSlot,
  subheadlineSlot,
}: SuccessHeaderProps) {
  const extra = parseCustomCss(customCss);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        textAlign: "center",
        padding: "40px 32px 36px",
        overflow: "hidden",
        ...extra,
      }}
    >
      {/* Top gradient line */}
      {topLine && (
        <div style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: 2,
          background: `linear-gradient(90deg, transparent, ${iconColor ?? "#4ade80"}, transparent)`,
          borderRadius: 2,
        }} />
      )}

      {/* Optional radial glow */}
      {glowColor && (
        <div style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 200,
          background: glowColor,
          pointerEvents: "none",
          opacity: 0.6,
        }} />
      )}

      {/* Icon */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: iconBackground ?? "rgba(74,222,128,0.1)",
        border: `1px solid ${iconBorderColor ?? "rgba(74,222,128,0.25)"}`,
        marginBottom: 24,
        position: "relative",
        zIndex: 1,
      }}>
        <SuccessCheckIcon color={iconColor ?? "#4ade80"} />
      </div>

      {/* Headline + subheadline (editable slots) */}
      <div style={{ position: "relative", zIndex: 1, color: "var(--campaign-text, #ffffff)" }}>
        {headlineSlot}
        {subheadlineSlot}
      </div>
    </div>
  );
}

// ─── 10. BrandFooter ─────────────────────────────────────────────────────────

export interface BrandFooterProps {
  brandText?: string;
  tagline?: string;
  brandFont?: "serif" | "sans";
  brandColor?: string;
  taglineColor?: string;
  background?: string;
  paddingY?: string;
  className?: string;
  customCss?: string;
}

export function BrandFooter({
  brandText = "VELERA",
  tagline,
  brandFont = "serif",
  brandColor = "",
  taglineColor = "",
  background,
  paddingY = "24px",
  className,
  customCss = "",
}: BrandFooterProps) {
  const extra = parseCustomCss(customCss);
  const brandFamily = brandFont === "serif" ? "var(--campaign-heading-font, Georgia, 'Times New Roman', serif)" : "var(--campaign-body-font, system-ui, sans-serif)";

  return (
    <footer
      className={className}
      style={{
        textAlign: "center",
        paddingTop: paddingY,
        paddingBottom: paddingY,
        background: background ?? undefined,
        borderTop: "1px solid var(--campaign-border, rgba(255,255,255,0.06))",
        ...extra,
      }}
    >
      <p style={{
        margin: "0 0 4px",
        fontFamily: brandFamily,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.15em",
        textTransform: "uppercase" as const,
        color: brandColor || "var(--campaign-text, rgba(255,255,255,0.25))",
      }}>
        {brandText}
      </p>
      {tagline && (
        <p style={{ margin: 0, fontSize: 11, color: taglineColor || "var(--campaign-text, rgba(255,255,255,0.2))", opacity: taglineColor ? 1 : 0.5, letterSpacing: "0.04em" }}>
          {tagline}
        </p>
      )}
    </footer>
  );
}

// ─── Puck block configs ───────────────────────────────────────────────────────

// Slot field + default-child helpers for the compositional blocks. A `slot`
// field turns a region into a selectable editable zone; its defaultProps seed
// the child nodes that appear when the block is first dropped.
const slotField = (label: string) => ({ type: "slot" as const, label });

interface ChildNode { type: string; props: Record<string, unknown> }
const txt = (content: string, props: Record<string, unknown> = {}): ChildNode => ({ type: "Text", props: { content, ...props } });
const btn = (label: string, props: Record<string, unknown> = {}): ChildNode => ({ type: "Button", props: { label, ...props } });

/** Render a Puck slot prop (a SlotComponent) to a ReactNode. */
function renderSlotProp(v: unknown): React.ReactNode {
  const C = v as React.ComponentType | undefined;
  return typeof C === "function" ? <C /> : null;
}

export const campaignBlockConfigs = {
  CampaignNav: {
    label: "Campaign Nav",
    icon: <Navigation size={16} />,
    permissions: { delete: false, duplicate: false },
    fields: {
      _content:          sectionField("Content"),
      logoText:          { type: "text" as const, label: "Logo text" },
      badgeText:         { type: "text" as const, label: "Badge text" },
      _style:            sectionField("Style"),
      logotype: {
        type: "radio" as const, label: "Logo font style",
        options: [{ value: "serif", label: "Serif" }, { value: "sans", label: "Sans" }],
      },
      logoColor:         colorCssField("Logo color"),
      logoLetterSpacing: dimensionField("Logo letter-spacing"),
      background:        colorCssField("Background"),
      borderColor:       colorCssField("Border color"),
      badgeBackground:   colorCssField("Badge background"),
      badgeTextColor:    colorCssField("Badge text color"),
      _advanced:         sectionField("Advanced"),
      fontImportUrl:     { type: "text" as const, label: "Google Fonts URL (optional)" },
      className:         { type: "text" as const, label: "CSS class" },
      customCss:         customCssField,
    },
    defaultProps: {
      logoText: "BRAND", badgeText: "Campaign", fontImportUrl: "",
      background: "", borderColor: "",
      logoColor: "", logotype: "serif", logoLetterSpacing: "5px",
      badgeBackground: "", badgeTextColor: "",
      className: "", customCss: "",
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles(); // ensure hook runs for theme subscription
      return (
        <CampaignNav
          logoText={props.logoText as string}
          badgeText={props.badgeText as string}
          fontImportUrl={props.fontImportUrl as string}
          background={props.background as string}
          borderColor={props.borderColor as string}
          logoColor={props.logoColor as string}
          logotype={props.logotype as "serif" | "sans"}
          logoLetterSpacing={props.logoLetterSpacing as string}
          badgeBackground={props.badgeBackground as string}
          badgeTextColor={props.badgeTextColor as string}
          className={props.className as string}
          customCss={props.customCss as string}
        />
      );
    },
  },

  Hero: {
    label: "Hero",
    icon: <HeroIcon size={16} />,
    fields: {
      _content:         sectionField("Content"),
      eyebrow:          slotField("Eyebrow"),
      headline:         slotField("Headline"),
      subheadline:      slotField("Subheadline"),
      _background:      sectionField("Background"),
      backgroundImage:  imageField("Background image"),
      imageFilter:      { type: "text" as const, label: "Image CSS filter" },
      overlayGradient: {
        type: "select" as const, label: "Overlay gradient",
        options: [{ value: "diagonal", label: "Diagonal" }, { value: "to-bottom", label: "To bottom" }, { value: "none", label: "None" }],
      },
      overlayColor:     colorCssField("Overlay color"),
      _layout:          sectionField("Layout"),
      height:           dimensionField("Height"),
      textAlign: alignField("Text align", ["left", "center"]),
      contentPosition: {
        type: "select" as const, label: "Content position",
        options: [
          { value: "bottom-left", label: "Bottom left" },
          { value: "center", label: "Center" },
          { value: "bottom-center", label: "Bottom center" },
        ],
      },
      paddingLeft:   dimensionField("Padding left"),
      paddingBottom: dimensionField("Padding bottom"),
      _advanced:     sectionField("Advanced"),
      className:     { type: "text" as const, label: "CSS class" },
      customCss:     customCssField,
    },
    resolveFields: (data: { props?: Record<string, unknown> }, { fields }: { fields: Fields }) =>
      data.props?.overlayGradient === "none" ? omitFields(fields, ["overlayColor"]) : fields,
    defaultProps: {
      backgroundImage: "", imageFilter: "brightness(0.35) saturate(0.6)",
      overlayGradient: "diagonal", overlayColor: "",
      height: "340px",
      textAlign: "left", contentPosition: "bottom-left",
      paddingLeft: "56px", paddingBottom: "48px",
      className: "", customCss: "",
      eyebrow: [txt("EYEBROW", { as: "p", size: "sm", weight: "semibold", color: "var(--campaign-accent, #e8b84b)" })],
      headline: [txt("Headline goes here", { as: "h1", size: "lg", weight: "semibold", fontSize: "clamp(36px,5vw,60px)" })],
      subheadline: [txt("Supporting subheadline that explains the offer.", { as: "p", size: "md" })],
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <Hero
          backgroundImage={props.backgroundImage as string}
          imageFilter={props.imageFilter as string}
          overlayGradient={props.overlayGradient as "diagonal" | "to-bottom" | "none"}
          overlayColor={props.overlayColor as string}
          height={props.height as string}
          textAlign={props.textAlign as "left" | "center"}
          contentPosition={props.contentPosition as "bottom-left" | "center" | "bottom-center"}
          paddingLeft={props.paddingLeft as string}
          paddingBottom={props.paddingBottom as string}
          className={props.className as string}
          customCss={props.customCss as string}
          eyebrowSlot={renderSlotProp(props.eyebrow)}
          headlineSlot={renderSlotProp(props.headline)}
          subheadlineSlot={renderSlotProp(props.subheadline)}
        />
      );
    },
  },

  SectionWrap: {
    label: "Section Wrap",
    icon: <LayoutPanelTop size={16} />,
    fields: {
      _layout:       sectionField("Layout"),
      maxWidth:      dimensionField("Max width"),
      centered: {
        type: "radio" as const, label: "Center content",
        options: [{ value: true, label: "Yes" }, { value: false, label: "No" }],
      },
      _spacing:      sectionField("Spacing"),
      paddingTop:    dimensionField("Padding top"),
      paddingBottom: dimensionField("Padding bottom"),
      paddingX:      dimensionField("Padding X"),
      _style:        sectionField("Style"),
      background:    colorCssField("Background"),
      _advanced:     sectionField("Advanced"),
      className: { type: "text" as const, label: "CSS class" },
      customCss: customCssField,
    },
    defaultProps: {
      maxWidth: "", paddingTop: "", paddingBottom: "",
      paddingX: "24px", background: "", centered: true,
      className: "", customCss: "",
    },
    render: (props: DefaultComponentProps & { puck: { isEditing: boolean } }) => {
      useCampaignStyles();
      return (
        <SectionWrap
          maxWidth={props.maxWidth as string}
          paddingTop={props.paddingTop as string}
          paddingBottom={props.paddingBottom as string}
          paddingX={props.paddingX as string}
          background={props.background as string}
          centered={Boolean(props.centered)}
          className={props.className as string}
          customCss={props.customCss as string}
        >
          <DropZone zone="children" />
        </SectionWrap>
      );
    },
  },

  TierGrid: {
    label: "Tier Grid",
    icon: <LayoutGrid size={16} />,
    fields: {
      _layout: sectionField("Layout"),
      columns: {
        type: "radio" as const, label: "Columns",
        options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }],
      },
      itemMaxWidth: dimensionField("Max card width"),
      justifyContent: {
        type: "select" as const, label: "Card alignment (row)",
        options: [
          { value: "stretch", label: "Stretch (fill width)" },
          { value: "start", label: "Left" },
          { value: "center", label: "Center" },
          { value: "end", label: "Right" },
          { value: "space-between", label: "Space between" },
        ],
      },
      alignItems: {
        type: "select" as const, label: "Vertical align (rows)",
        options: [
          { value: "stretch", label: "Stretch (equal height)" },
          { value: "start", label: "Top" },
          { value: "center", label: "Center" },
          { value: "end", label: "Bottom" },
        ],
      },
      _spacing:   sectionField("Spacing"),
      gap:        dimensionField("Gap"),
      rowGap:     dimensionField("Row gap (override)"),
      columnGap:  dimensionField("Column gap (override)"),
      padding:   spacingField("Padding"),
      margin:    spacingField("Margin"),
      _advanced: sectionField("Advanced"),
      className: { type: "text" as const, label: "CSS class" },
      customCss: customCssField,
    },
    defaultProps: {
      columns: "2", itemMaxWidth: "", justifyContent: "stretch",
      gap: "", rowGap: "", columnGap: "",
      alignItems: "stretch",
      padding: SPACING_ZERO, margin: SPACING_ZERO,
      className: "", customCss: "",
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <DropZone
          zone="children"
          style={tierGridStyle({
            columns: props.columns as TierGridProps["columns"],
            itemMaxWidth: props.itemMaxWidth as string,
            justifyContent: props.justifyContent as GridJustify,
            gap: props.gap as string,
            rowGap: props.rowGap as string,
            columnGap: props.columnGap as string,
            alignItems: props.alignItems as GridAlign,
            padding: props.padding as SpacingValue,
            margin: props.margin as SpacingValue,
            customCss: props.customCss as string,
          })}
        />
      );
    },
  },

  TierCard: {
    label: "Tier Card",
    icon: <CreditCard size={16} />,
    fields: {
      _content:       sectionField("Content"),
      heading:        slotField("Heading (title + price)"),
      features:       slotField("Features"),
      footer:         slotField("Footer (CTA + note)"),
      tierLabel: { type: "text" as const, label: "Tier label" },
      tierIcon: {
        type: "radio" as const, label: "Tier icon",
        options: [{ value: "circle", label: "Circle" }, { value: "star", label: "Star" }, { value: "none", label: "None" }],
      },
      featuredLabel:  { type: "text" as const, label: "Featured label (empty to hide)" },
      _style:         sectionField("Style"),
      accentColor:    colorCssField("Accent color"),
      topLine: {
        type: "radio" as const, label: "Top line position",
        options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "none", label: "None" }],
      },
      background:   colorCssField("Background"),
      borderColor:  colorCssField("Border color"),
      borderRadius: radiusField("Corner radius"),
      isFeatured: {
        type: "radio" as const, label: "Featured card",
        options: [{ value: false, label: "No" }, { value: true, label: "Yes" }],
      },
      _advanced:  sectionField("Advanced"),
      className:  { type: "text" as const, label: "CSS class" },
      customCss:  customCssField,
    },
    defaultProps: {
      tierLabel: "Tier I", tierIcon: "circle", accentColor: "",
      featuredLabel: "",
      topLine: "left", background: "",
      borderColor: "", borderRadius: "", isFeatured: false,
      className: "", customCss: "",
      heading: [
        txt("Starter", { as: "h3", size: "lg", weight: "semibold" }),
        txt("90 Days Free", { as: "p", size: "lg", weight: "semibold" }),
        txt("No commitment required", { as: "p", size: "sm" }),
      ],
      features: [
        txt("Feature one", { as: "p", size: "sm" }),
        txt("Feature two", { as: "p", size: "sm" }),
      ],
      footer: [
        btn("Get started", { appearance: "solid", tone: "action", width: "100%" }),
      ],
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <TierCard
          tierLabel={props.tierLabel as string}
          tierIcon={props.tierIcon as "circle" | "star" | "none"}
          accentColor={props.accentColor as string}
          featuredLabel={props.featuredLabel as string}
          topLine={props.topLine as "left" | "center" | "none"}
          background={props.background as string}
          borderColor={props.borderColor as string}
          borderRadius={props.borderRadius as string}
          isFeatured={Boolean(props.isFeatured)}
          className={props.className as string}
          customCss={props.customCss as string}
          headingSlot={renderSlotProp(props.heading)}
          featuresSlot={renderSlotProp(props.features)}
          footerSlot={renderSlotProp(props.footer)}
        />
      );
    },
  },

  FeatureList: {
    label: "Feature List",
    icon: <ListChecks size={16} />,
    fields: {
      _content: sectionField("Content"),
      items: {
        type: "array" as const, label: "Items",
        arrayFields: { text: { type: "text" as const, label: "Text" } },
        defaultItemProps: { text: "Feature" },
      },
      _style: sectionField("Style"),
      accentColor: colorCssField("Accent color (icons)"),
      textColor:   colorCssField("Text color"),
      fontSize:    dimensionField("Font size"),
      iconStyle: {
        type: "radio" as const, label: "Icon style",
        options: [{ value: "circle", label: "Circle" }, { value: "bare", label: "Bare" }],
      },
      size: {
        type: "radio" as const, label: "Size",
        options: [{ value: "sm", label: "SM" }, { value: "md", label: "MD" }, { value: "lg", label: "LG" }],
      },
      gap: {
        type: "radio" as const, label: "Gap",
        options: [{ value: "tight", label: "Tight" }, { value: "normal", label: "Normal" }, { value: "loose", label: "Loose" }],
      },
      _advanced: sectionField("Advanced"),
      className: { type: "text" as const, label: "CSS class" },
      customCss: customCssField,
    },
    defaultProps: {
      items: [{ text: "Feature one" }, { text: "Feature two" }],
      accentColor: "", textColor: "", fontSize: "", iconStyle: "circle",
      size: "md", gap: "normal",
      className: "", customCss: "",
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <FeatureList
          items={props.items as FeatureListItem[]}
          accentColor={props.accentColor as string}
          textColor={props.textColor as string}
          fontSize={props.fontSize as string}
          iconStyle={props.iconStyle as "circle" | "bare"}
          size={props.size as "sm" | "md" | "lg"}
          gap={props.gap as "tight" | "normal" | "loose"}
          className={props.className as string}
          customCss={props.customCss as string}
        />
      );
    },
  },

  Divider: {
    label: "Divider",
    icon: <Minus size={16} />,
    fields: {
      _content:   sectionField("Content"),
      label:      { type: "text" as const, label: "Center label (optional)" },
      _style:     sectionField("Style"),
      labelColor: colorCssField("Label color"),
      lineColor:  colorCssField("Line color"),
      paddingY:   dimensionField("Padding Y"),
      _advanced:  sectionField("Advanced"),
      className:  { type: "text" as const, label: "CSS class" },
      customCss:  customCssField,
    },
    defaultProps: {
      label: "", labelColor: "",
      lineColor: "", paddingY: "36px",
      className: "", customCss: "",
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <Divider
          label={props.label as string}
          labelColor={props.labelColor as string}
          lineColor={props.lineColor as string}
          paddingY={props.paddingY as string}
          className={props.className as string}
          customCss={props.customCss as string}
        />
      );
    },
  },

  StepItem: {
    label: "Step Item",
    icon: <ListOrdered size={16} />,
    fields: {
      _content:    sectionField("Content"),
      title:       slotField("Title"),
      description: slotField("Description"),
      _layout:     sectionField("Layout"),
      direction: {
        type: "radio" as const, label: "Layout",
        options: [{ value: "row", label: "Icon left" }, { value: "column", label: "Icon top" }],
      },
      align: {
        type: "select" as const, label: "Align",
        options: [{ value: "center", label: "Center" }, { value: "start", label: "Top" }, { value: "stretch", label: "Stretch" }],
      },
      gap:     dimensionField("Gap"),
      padding: spacingField("Padding"),
      margin:  spacingField("Margin"),
      _container:   sectionField("Container"),
      background:   colorCssField("Background"),
      borderColor:  colorCssField("Border color"),
      borderWidth:  dimensionField("Border width"),
      borderRadius: radiusField("Corner radius"),
      _icon:           sectionField("Icon"),
      icon:            { type: "text" as const, label: "Icon (emoji or text)" },
      showIcon: {
        type: "radio" as const, label: "Show icon",
        options: [{ value: true, label: "Yes" }, { value: false, label: "No" }],
      },
      iconSize:        dimensionField("Icon box size"),
      iconFontSize:    dimensionField("Icon glyph size"),
      iconBackground:  colorCssField("Icon background"),
      iconBorderColor: colorCssField("Icon border"),
      iconRadius:      radiusField("Icon radius"),
      _advanced:   sectionField("Advanced"),
      className:   { type: "text" as const, label: "CSS class" },
      customCss:   customCssField,
    },
    resolveFields: (data: { props?: Record<string, unknown> }, { fields }: { fields: Fields }) =>
      data.props?.showIcon === false
        ? omitFields(fields, ["icon", "iconSize", "iconFontSize", "iconBackground", "iconBorderColor", "iconRadius"])
        : fields,
    defaultProps: {
      icon: "📬", showIcon: true,
      iconSize: "44px", iconFontSize: "20px", iconBackground: "", iconBorderColor: "", iconRadius: "10px",
      direction: "row", align: "center", gap: "",
      padding: SPACING_ZERO, margin: SPACING_ZERO,
      background: "", borderColor: "", borderWidth: "", borderRadius: "",
      className: "", customCss: "",
      title: [txt("Check your email", { as: "p", size: "md", weight: "semibold" })],
      description: [txt("We sent a confirmation to your inbox.", { as: "p", size: "sm" })],
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <StepItem
          icon={props.icon as string}
          showIcon={Boolean(props.showIcon)}
          iconSize={props.iconSize as string}
          iconFontSize={props.iconFontSize as string}
          iconBackground={props.iconBackground as string}
          iconBorderColor={props.iconBorderColor as string}
          iconRadius={props.iconRadius as string}
          direction={props.direction as "row" | "column"}
          align={props.align as "start" | "center" | "stretch"}
          gap={props.gap as string}
          padding={props.padding as SpacingValue}
          margin={props.margin as SpacingValue}
          background={props.background as string}
          borderColor={props.borderColor as string}
          borderWidth={props.borderWidth as string}
          borderRadius={props.borderRadius as string}
          className={props.className as string}
          customCss={props.customCss as string}
          titleSlot={renderSlotProp(props.title)}
          descriptionSlot={renderSlotProp(props.description)}
        />
      );
    },
  },

  SuccessHeader: {
    label: "Success Header",
    icon: <CheckCircle2 size={16} />,
    fields: {
      _content:        sectionField("Content"),
      headline:        slotField("Headline"),
      subheadline:     slotField("Subheadline"),
      _icon:           sectionField("Icon"),
      iconBackground:  colorCssField("Icon background"),
      iconBorderColor: colorCssField("Icon border color"),
      iconColor:       colorCssField("Icon color"),
      _style:          sectionField("Style"),
      topLine: {
        type: "radio" as const, label: "Top gradient line",
        options: [{ value: true, label: "Show" }, { value: false, label: "Hide" }],
      },
      glowColor:  colorCssField("Glow gradient"),
      _advanced:  sectionField("Advanced"),
      className:  { type: "text" as const, label: "CSS class" },
      customCss:  customCssField,
    },
    defaultProps: {
      iconBackground: "rgba(74,222,128,0.1)", iconBorderColor: "rgba(74,222,128,0.25)",
      iconColor: "#4ade80",
      topLine: true, glowColor: "",
      className: "", customCss: "",
      headline: [txt("You're In.", { as: "h1", size: "lg", weight: "semibold", fontSize: "46px" })],
      subheadline: [txt("Thanks for signing up — check your inbox for next steps.", { as: "p", size: "md" })],
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <SuccessHeader
          iconBackground={props.iconBackground as string}
          iconBorderColor={props.iconBorderColor as string}
          iconColor={props.iconColor as string}
          topLine={Boolean(props.topLine)}
          glowColor={props.glowColor as string}
          className={props.className as string}
          customCss={props.customCss as string}
          headlineSlot={renderSlotProp(props.headline)}
          subheadlineSlot={renderSlotProp(props.subheadline)}
        />
      );
    },
  },

  BrandFooter: {
    label: "Brand Footer",
    icon: <PanelBottom size={16} />,
    permissions: { delete: false, duplicate: false },
    fields: {
      _content:   sectionField("Content"),
      brandText:  { type: "text" as const, label: "Brand name" },
      tagline:    { type: "text" as const, label: "Tagline" },
      _style:     sectionField("Style"),
      brandFont: {
        type: "radio" as const, label: "Brand font",
        options: [{ value: "serif", label: "Serif" }, { value: "sans", label: "Sans" }],
      },
      brandColor: colorCssField("Brand text color"),
      taglineColor: colorCssField("Tagline color"),
      background: colorCssField("Background"),
      paddingY:   dimensionField("Padding Y"),
      _advanced:  sectionField("Advanced"),
      className:  { type: "text" as const, label: "CSS class" },
      customCss:  customCssField,
    },
    defaultProps: {
      brandText: "VELERA", tagline: "", brandFont: "serif",
      brandColor: "", taglineColor: "", background: "",
      paddingY: "24px", className: "", customCss: "",
    },
    render: (props: DefaultComponentProps) => {
      useCampaignStyles();
      return (
        <BrandFooter
          brandText={props.brandText as string}
          tagline={props.tagline as string}
          brandFont={props.brandFont as "serif" | "sans"}
          brandColor={props.brandColor as string}
          taglineColor={props.taglineColor as string}
          background={props.background as string}
          paddingY={props.paddingY as string}
          className={props.className as string}
          customCss={props.customCss as string}
        />
      );
    },
  },
};

// ─── Legacy → slot migration ──────────────────────────────────────────────────
// Pre-slot compositions stored Hero/TierCard/StepItem/SuccessHeader text as
// plain string/array props. The fields are now Puck `slot`s (which expect a
// PuckItem[]), so Puck crashes if it loads the old shape. Normalize a stored
// composition on load in the editor, converting legacy props into slot children.

interface AnyItem { type: string; props: Record<string, unknown> }
interface PuckData { content?: AnyItem[]; zones?: Record<string, AnyItem[]>; root?: unknown }

const uid = () => Math.random().toString(36).slice(2, 10);
const mkText = (content: string, props: Record<string, unknown> = {}): AnyItem => ({
  type: "Text",
  props: { id: `Text-${uid()}`, content, ...props },
});
const isItemArray = (v: unknown): boolean =>
  Array.isArray(v) && (v.length === 0 || (typeof v[0] === "object" && v[0] !== null && "type" in (v[0] as object)));

function migrateItem(item: AnyItem): AnyItem {
  const p = item.props ?? {};
  const str = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string) : "");
  switch (item.type) {
    case "Hero": {
      if (isItemArray(p.headline)) return item; // already migrated
      const next = { ...p };
      next.eyebrow = str("eyebrow") ? [mkText(str("eyebrow"), { as: "p", size: "sm", weight: "semibold", color: "var(--campaign-accent, #e8b84b)" })] : [];
      next.headline = [mkText(str("headline") || "Headline goes here", { as: "h1", size: "lg", weight: "semibold", fontSize: (p.headlineFontSize as string) || "clamp(36px,5vw,60px)" })];
      next.subheadline = str("subheadline") ? [mkText(str("subheadline"), { as: "p", size: "md" })] : [];
      return { ...item, props: next };
    }
    case "TierCard": {
      if (isItemArray(p.heading)) return item;
      const next = { ...p };
      next.heading = [
        ...(str("title") ? [mkText(str("title"), { as: "h3", size: "lg", weight: "semibold" })] : []),
        ...(str("price") ? [mkText(str("price"), { as: "p", size: "lg", weight: "semibold" })] : []),
        ...(str("priceSubtext") ? [mkText(str("priceSubtext"), { as: "p", size: "sm" })] : []),
      ];
      next.features = Array.isArray(p.features)
        ? (p.features as { text?: string }[]).filter((f) => typeof f?.text === "string").map((f) => mkText(f.text as string, { as: "p", size: "sm" }))
        : [];
      next.footer = str("ctaLabel") ? [{ type: "campaign-conversion-button", props: { id: `campaign-conversion-button-${uid()}`, label: str("ctaLabel"), navigateTo: "next" } }] : [];
      return { ...item, props: next };
    }
    case "StepItem": {
      if (isItemArray(p.title)) return item;
      const next = { ...p };
      next.title = [mkText(str("title") || "Step title", { as: "p", size: "md", weight: "semibold" })];
      next.description = str("description") ? [mkText(str("description"), { as: "p", size: "sm" })] : [];
      return { ...item, props: next };
    }
    case "SuccessHeader": {
      if (isItemArray(p.headline)) return item;
      const next = { ...p };
      next.headline = [mkText(str("headline") || "You're in.", { as: "h1", size: "lg", weight: "semibold", fontSize: (p.headlineFontSize as string) || "46px" })];
      next.subheadline = str("subheadline") ? [mkText(str("subheadline"), { as: "p", size: "md" })] : [];
      return { ...item, props: next };
    }
    default:
      return item;
  }
}

/** Normalize a stored Puck composition so legacy text props become slot children. */
export function migrateLegacySlots<T extends PuckData>(data: T): T {
  if (!data || typeof data !== "object") return data;
  const content = Array.isArray(data.content) ? data.content.map(migrateItem) : data.content;
  const zones = data.zones
    ? Object.fromEntries(Object.entries(data.zones).map(([k, v]) => [k, Array.isArray(v) ? v.map(migrateItem) : v]))
    : data.zones;
  return { ...data, content, zones };
}
