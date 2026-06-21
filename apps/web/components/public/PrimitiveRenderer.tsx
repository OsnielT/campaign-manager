"use client";

import React, { useContext } from "react";
import { Box, Stack, Text, Button, Card, Badge, Input, Textarea } from "@twinaholic/react";
import { CampaignThemeContext, computeCampaignStyles, type CampaignStyles } from "@/lib/builder/campaign-theme-context";
import {
  CampaignNav,
  Hero,
  SectionWrap,
  TierGrid,
  TierCard,
  FeatureList,
  Divider,
  StepItem,
  SuccessHeader,
  BrandFooter,
  type FeatureListItem,
} from "@/lib/builder/campaign-blocks";
import { sanitizeRichText } from "@/lib/sanitize";

// ─── Puck data types ──────────────────────────────────────────────────────────

interface PuckItem {
  type: string;
  props: Record<string, unknown>;
}

interface PuckData {
  content: PuckItem[];
  root?: { props?: Record<string, unknown> };
  zones?: Record<string, PuckItem[]>;
}

/**
 * True when the current page is wrapped in a single page-level <form> (the
 * default). Submit controls (conversion button, campaign form) read this and
 * contribute a submit button + their fields instead of nesting their own form,
 * so every input on the page is captured. Widgets that submit themselves (e.g.
 * audience-lookup, which POSTs via AJAX to a different endpoint) opt the page
 * out of the wrapper to avoid illegal nested forms.
 */
const PageFormContext = React.createContext(false);

// Widgets that manage their own submission — a page containing one is NOT
// wrapped in a page-level form.
const SELF_SUBMIT_TYPES = new Set(["audience-lookup", "campaign-auto-advance"]);
function pageSelfSubmits(content: PuckItem[], zones: Record<string, PuckItem[]>): boolean {
  const all = [...content, ...Object.values(zones).flat()];
  return all.some((n) => SELF_SUBMIT_TYPES.has(n.type));
}

// ─── Session context for campaign-specific nodes ──────────────────────────────

export interface RendererContext {
  sessionId: string | null;
  orgSlug: string;
  campaignSlug: string;
  pageTitle: string;
  pagePath: string;
  formData: Record<string, unknown>;
  audienceRecord: {
    id: string;
    fields: Record<string, unknown>;
    name: string | null;
    email: string | null;
  } | null;
}

/**
 * Puck stores unset props as the literal string "undefined" or "" in the
 * composition JSON. The design-system components use `??` to apply defaults,
 * which only catches real `undefined`/`null`. This helper normalises those
 * junk strings so the components see actual `undefined` and fall through to
 * their spec defaults.
 */
function prop<T extends string>(value: unknown): T | undefined {
  if (value == null) return undefined;
  const s = String(value);
  if (s === "" || s === "undefined") return undefined;
  return s as T;
}

/** Parse "color: red; font-size: 16px" → { color: "red", fontSize: "16px" } */
function parseCustomCss(raw: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const decl of raw.split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const key = decl.slice(0, colon).trim();
    const val = decl.slice(colon + 1).trim();
    if (!key || !val) continue;
    const camel = key.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    result[camel] = val;
  }
  return result as React.CSSProperties;
}

/** Convert spacing object {top,right,bottom,left} → CSS shorthand, or undefined */
function spacingToCss(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { top = 0, right = 0, bottom = 0, left = 0 } = v as { top?: number; right?: number; bottom?: number; left?: number };
  if (!top && !right && !bottom && !left) return undefined;
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

const CSS_OVERRIDE_KEYS = [
  "width", "maxWidth", "minHeight",
  "backgroundColor", "color", "background", "borderRadius", "border", "opacity",
  "fontSize", "lineHeight", "textAlign",
];

/** Extract all CSS override props + customCss into a merged style object */
function cssStyle(p: Record<string, unknown>): React.CSSProperties {
  const s: Record<string, string | number> = {};
  // Spacing objects
  const pad = spacingToCss(p.padding);
  const mar = spacingToCss(p.margin);
  if (pad) s.padding = pad;
  if (mar) s.margin = mar;
  // Scalar overrides
  for (const k of CSS_OVERRIDE_KEYS) {
    const v = p[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number") { s[k] = v; continue; }
    if (typeof v === "string" && v.trim()) s[k] = v.trim();
  }
  return { ...s, ...parseCustomCss((p.customCss as string) || "") } as React.CSSProperties;
}

function cn(p: Record<string, unknown>): string | undefined {
  return (p.className as string) || undefined;
}

// ─── Core renderer ────────────────────────────────────────────────────────────

export function PrimitiveRenderer({
  data,
  ctx,
}: {
  data: PuckData | null;
  ctx: RendererContext;
}) {
  const theme = useContext(CampaignThemeContext);
  const cs = computeCampaignStyles(theme);

  if (!data) return null;

  const content = data.content ?? [];
  const zones = data.zones ?? {};
  const inPageForm = !pageSelfSubmits(content, zones);
  const submitUrl = `/api/public/${ctx.orgSlug}/${ctx.campaignSlug}/submit`;
  const items = renderItems(content, zones, ctx, cs);

  return (
    <div
      style={{
        backgroundColor:
          (data.root?.props?.backgroundColor as string) || cs.canvas?.backgroundColor || undefined,
        minHeight: "100vh",
      }}
    >
      <PageFormContext.Provider value={inPageForm}>
        {inPageForm ? (
          <form method="POST" action={submitUrl} style={{ display: "contents" }}>
            <input type="hidden" name="_sessionId" value={ctx.sessionId ?? ""} />
            {items}
          </form>
        ) : (
          items
        )}
      </PageFormContext.Provider>
    </div>
  );
}

function renderItems(
  items: PuckItem[],
  zones: Record<string, PuckItem[]>,
  ctx: RendererContext,
  cs: CampaignStyles
): React.ReactNode {
  return items.map((item) => renderNode(item, zones, ctx, cs));
}

function renderNode(
  item: PuckItem,
  zones: Record<string, PuckItem[]>,
  ctx: RendererContext,
  cs: CampaignStyles
): React.ReactNode {
  const id = item.props.id as string;
  const p = item.props;

  // Children are stored in zones under "{id}:children"
  const childZoneKey = `${id}:children`;
  const children = zones[childZoneKey]
    ? renderItems(zones[childZoneKey], zones, ctx, cs)
    : null;

  // Slot regions (compositional blocks) store their children inline in props as
  // a PuckItem[]. Render them, or fall back to a legacy text prop so pre-slot
  // compositions don't render blank.
  const legacyText = (v: unknown, props: Record<string, unknown> = {}): PuckItem[] | undefined =>
    typeof v === "string" && v.trim() ? [{ type: "Text", props: { content: v, ...props } }] : undefined;
  // A slot value is a real PuckItem[] (each child has a `type`); legacy
  // non-slot arrays (e.g. [{text}]) fall through to the provided fallback.
  const isSlot = (v: unknown): v is PuckItem[] =>
    Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && "type" in v[0];
  const renderSlot = (v: unknown, fallback?: PuckItem[]): React.ReactNode => {
    if (isSlot(v)) return renderItems(v, zones, ctx, cs);
    if (fallback && fallback.length) return renderItems(fallback, zones, ctx, cs);
    return null;
  };

  // Reusable inherit base for label/field text
  const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
  const fieldInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit", ...cs.cardRadius };
  const slotInherit = { style: textInherit };

  switch (item.type) {
    case "Box": {
      const surface = p.surface as string | undefined;
      const surfaceOverride =
        surface === "canvas" ? cs.canvas :
        (surface === "subtle" || surface === "sunken") ? cs.surface :
        null;
      const style = { ...surfaceOverride, ...cs.font, ...cs.cardRadius, ...cssStyle(p) };
      const cls = cn(p);
      const el = (
        <Box
          key={id}
          size={prop<"sm" | "md" | "lg">(p.size)}
          surface={prop<"canvas" | "subtle" | "sunken" | "action" | "success" | "warning" | "danger">(p.surface)}
          emphasis={prop<"flat" | "outlined" | "elevated">(p.emphasis)}
          style={style}
        >
          {children}
        </Box>
      );
      return cls ? <div key={id} className={cls}>{el}</div> : el;
    }

    case "Stack": {
      const style = { ...cs.font, ...cssStyle(p) };
      const cls = cn(p);
      const el = (
        <Stack
          key={id}
          direction={prop<"vertical" | "horizontal">(p.direction)}
          size={prop<"sm" | "md" | "lg">(p.size)}
          align={prop<"start" | "center" | "end" | "stretch">(p.align)}
          wrap={Boolean(p.wrap)}
          style={style}
        >
          {children}
        </Stack>
      );
      return cls ? <div key={id} className={cls}>{el}</div> : el;
    }

    case "Text": {
      const tone = p.tone as string | undefined;
      const applyText = !tone || tone === "primary" || tone === "secondary";
      const style: React.CSSProperties = {
        color: "inherit",
        fontFamily: "inherit",
        ...(applyText ? cs.text : null),
        ...cssStyle(p),
      };
      const cls = cn(p);
      const el = (
        <Text
          key={id}
          as={p.as as React.ElementType | undefined}
          size={prop<"sm" | "md" | "lg">(p.size)}
          tone={prop<"primary" | "secondary" | "inverse" | "action" | "success" | "warning" | "danger">(p.tone)}
          weight={prop<"regular" | "medium" | "semibold">(p.weight)}
          style={style}
        >
          {p.content as string}
        </Text>
      );
      return cls ? <div key={id} className={cls}>{el}</div> : el;
    }

    case "Button": {
      const tone = p.tone as string | undefined;
      const appearance = p.appearance as string | undefined;
      const style: React.CSSProperties = {
        fontFamily: "inherit",
        ...(tone === "action" && appearance === "solid" ? cs.action : null),
        ...cs.font,
        ...cs.btnRadius,
        ...cssStyle(p),
      };
      const cls = cn(p);
      const el = (
        <Button
          key={id}
          size={prop<"sm" | "md" | "lg">(p.size)}
          appearance={prop<"solid" | "outline" | "ghost">(p.appearance)}
          tone={prop<"action" | "success" | "warning" | "danger" | "neutral">(p.tone)}
          style={style}
        >
          {p.label as string}
        </Button>
      );
      return cls ? <div key={id} className={cls}>{el}</div> : el;
    }

    case "Card": {
      const surface = p.surface as string | undefined;
      const surfaceOverride =
        surface === "canvas" ? cs.canvas :
        (surface === "subtle" || surface === "sunken") ? cs.surface :
        null;
      const style = { ...surfaceOverride, ...cs.cardRadius, ...cssStyle(p) };
      const cls = cn(p);
      const el = (
        <Card
          key={id}
          size={prop<"sm" | "md" | "lg">(p.size)}
          surface={prop<"canvas" | "subtle" | "sunken" | "action" | "success" | "warning" | "danger">(p.surface)}
          emphasis={prop<"flat" | "outlined" | "elevated">(p.emphasis)}
          style={style}
          slotProps={{ header: slotInherit, body: slotInherit, footer: slotInherit }}
        >
          {children}
        </Card>
      );
      return cls ? <div key={id} className={cls}>{el}</div> : el;
    }

    case "Badge": {
      const tone = p.tone as string | undefined;
      const extra = parseCustomCss((p.customCss as string) || "");
      const cls = cn(p);
      const style: React.CSSProperties = {
        fontFamily: "inherit",
        ...(tone !== "action" ? { color: "inherit" } : {}),
        ...(tone === "action" ? cs.action : null),
        ...cs.font,
        ...cs.btnRadius,
        ...extra,
      };
      const el = (
        <Badge
          key={id}
          size={prop<"sm" | "md" | "lg">(p.size)}
          tone={prop<"neutral" | "action" | "success" | "warning" | "danger">(p.tone)}
          appearance={prop<"solid" | "soft" | "outline">(p.appearance)}
          style={style}
        >
          {p.content as string}
        </Badge>
      );
      return cls ? <div key={id} className={cls}>{el}</div> : el;
    }

    case "Input":
      return (
        <Input
          key={id}
          name={(p.name as string) || (p.id as string)}
          label={prop(p.label)}
          placeholder={prop(p.placeholder)}
          description={prop(p.description)}
          type={prop(p.inputType)}
          size={prop<"sm" | "md" | "lg">(p.size)}
          appearance={prop<"outline" | "filled">(p.appearance)}
          tone={prop<"neutral" | "success" | "danger">(p.tone)}
          labelStyle={textInherit}
          inputStyle={fieldInherit}
          descriptionStyle={textInherit}
        />
      );

    case "Textarea":
      return (
        <Textarea
          key={id}
          name={(p.name as string) || (p.id as string)}
          label={prop(p.label)}
          placeholder={prop(p.placeholder)}
          description={prop(p.description)}
          size={prop<"sm" | "md" | "lg">(p.size)}
          appearance={prop<"outline" | "filled">(p.appearance)}
          rows={p.rows as number | undefined}
          labelStyle={textInherit}
          textareaStyle={fieldInherit}
          descriptionStyle={textInherit}
        />
      );

    case "Image": {
      const extra = parseCustomCss((p.customCss as string) || "");
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={p.src as string}
          alt={p.alt as string}
          className={(p.className as string) || undefined}
          style={{
            width: (p.width as string) || "100%",
            height: (p.height as string) || "auto",
            objectFit: (p.objectFit as "cover" | "contain" | "fill") || "cover",
            display: "block",
            ...(p.borderRadius ? { borderRadius: p.borderRadius as string } : {}),
            ...(p.opacity !== "" && p.opacity !== undefined ? { opacity: p.opacity as number } : {}),
            ...(extra as React.CSSProperties),
          }}
        />
      );
    }

    case "RichText": {
      const style = cssStyle(p);
      const cls = cn(p);
      return (
        <div
          key={id}
          className={["primitive-richtext", cls].filter(Boolean).join(" ")}
          style={{ lineHeight: 1.7, ...style }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichText((p.content as string) || "") }}
        />
      );
    }

    // ── Campaign block organisms ───────────────────────────────────────────────

    case "CampaignNav":
      return (
        <CampaignNav
          key={id}
          logoText={p.logoText as string}
          badgeText={p.badgeText as string}
          fontImportUrl={p.fontImportUrl as string}
          background={p.background as string}
          borderColor={p.borderColor as string}
          logoColor={p.logoColor as string}
          logotype={p.logotype as "serif" | "sans"}
          logoLetterSpacing={p.logoLetterSpacing as string}
          badgeBackground={p.badgeBackground as string}
          badgeTextColor={p.badgeTextColor as string}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
        />
      );

    case "Hero":
      return (
        <Hero
          key={id}
          backgroundImage={p.backgroundImage as string}
          imageFilter={p.imageFilter as string}
          overlayGradient={p.overlayGradient as "diagonal" | "to-bottom" | "none"}
          overlayColor={p.overlayColor as string}
          height={p.height as string}
          textAlign={p.textAlign as "left" | "center"}
          contentPosition={p.contentPosition as "bottom-left" | "center" | "bottom-center"}
          paddingLeft={p.paddingLeft as string}
          paddingBottom={p.paddingBottom as string}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
          eyebrowSlot={renderSlot(p.eyebrow, legacyText(p.eyebrow, { as: "p", size: "sm", weight: "semibold" }))}
          headlineSlot={renderSlot(p.headline, legacyText(p.headline, { as: "h1", size: "lg", weight: "semibold" }))}
          subheadlineSlot={renderSlot(p.subheadline, legacyText(p.subheadline, { as: "p", size: "md" }))}
        />
      );

    case "SectionWrap": {
      const sectionZoneKey = `${id}:children`;
      const sectionChildren = zones[sectionZoneKey]
        ? renderItems(zones[sectionZoneKey], zones, ctx, cs)
        : null;
      return (
        <SectionWrap
          key={id}
          maxWidth={p.maxWidth as string}
          paddingTop={p.paddingTop as string}
          paddingBottom={p.paddingBottom as string}
          paddingX={p.paddingX as string}
          background={p.background as string}
          centered={Boolean(p.centered)}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
        >
          {sectionChildren}
        </SectionWrap>
      );
    }

    case "TierGrid": {
      const gridZoneKey = `${id}:children`;
      const gridChildren = zones[gridZoneKey]
        ? renderItems(zones[gridZoneKey], zones, ctx, cs)
        : null;
      return (
        <TierGrid
          key={id}
          columns={p.columns as "1" | "2" | "3" | "4"}
          itemMaxWidth={p.itemMaxWidth as string}
          justifyContent={p.justifyContent as never}
          gap={p.gap as string}
          rowGap={p.rowGap as string}
          columnGap={p.columnGap as string}
          alignItems={p.alignItems as never}
          padding={p.padding as never}
          margin={p.margin as never}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
        >
          {gridChildren}
        </TierGrid>
      );
    }

    case "TierCard": {
      // Legacy fallback: pre-slot data carried title/price/features as props.
      const legacyHeading = [
        ...(legacyText(p.title, { as: "h3", size: "lg", weight: "semibold" }) ?? []),
        ...(legacyText(p.price, { as: "p", size: "lg", weight: "semibold" }) ?? []),
        ...(legacyText(p.priceSubtext, { as: "p", size: "sm" }) ?? []),
      ];
      const legacyFeatures: PuckItem[] = ((p.features as { text?: string }[]) ?? [])
        .filter((f) => typeof f?.text === "string")
        .map((f) => ({ type: "Text", props: { content: f.text as string, as: "p", size: "sm" } }));
      return (
        <TierCard
          key={id}
          tierLabel={p.tierLabel as string}
          tierIcon={p.tierIcon as "circle" | "star" | "none"}
          accentColor={p.accentColor as string}
          featuredLabel={p.featuredLabel as string}
          topLine={p.topLine as "left" | "center" | "none"}
          background={p.background as string}
          borderColor={p.borderColor as string}
          borderRadius={p.borderRadius as string}
          isFeatured={Boolean(p.isFeatured)}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
          headingSlot={renderSlot(p.heading, legacyHeading.length ? legacyHeading : undefined)}
          featuresSlot={renderSlot(p.features, legacyFeatures.length ? legacyFeatures : undefined)}
          footerSlot={renderSlot(p.footer)}
        />
      );
    }

    case "FeatureList":
      return (
        <FeatureList
          key={id}
          items={(p.items as FeatureListItem[]) ?? []}
          accentColor={p.accentColor as string}
          textColor={p.textColor as string}
          fontSize={p.fontSize as string}
          iconStyle={p.iconStyle as "circle" | "bare"}
          size={p.size as "sm" | "md" | "lg"}
          gap={p.gap as "tight" | "normal" | "loose"}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
        />
      );

    case "Divider":
      return (
        <Divider
          key={id}
          label={p.label as string}
          labelColor={p.labelColor as string}
          lineColor={p.lineColor as string}
          paddingY={p.paddingY as string}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
        />
      );

    case "StepItem":
      return (
        <StepItem
          key={id}
          icon={p.icon as string}
          showIcon={p.showIcon === undefined ? true : Boolean(p.showIcon)}
          iconSize={p.iconSize as string}
          iconFontSize={p.iconFontSize as string}
          iconBackground={p.iconBackground as string}
          iconBorderColor={p.iconBorderColor as string}
          iconRadius={p.iconRadius as string}
          direction={p.direction as "row" | "column"}
          align={p.align as "start" | "center" | "stretch"}
          gap={p.gap as string}
          padding={p.padding as never}
          margin={p.margin as never}
          background={p.background as string}
          borderColor={p.borderColor as string}
          borderWidth={p.borderWidth as string}
          borderRadius={p.borderRadius as string}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
          titleSlot={renderSlot(p.title, legacyText(p.title, { as: "p", size: "md", weight: "semibold" }))}
          descriptionSlot={renderSlot(p.description, legacyText(p.description, { as: "p", size: "sm" }))}
        />
      );

    case "SuccessHeader":
      return (
        <SuccessHeader
          key={id}
          iconBackground={p.iconBackground as string}
          iconBorderColor={p.iconBorderColor as string}
          iconColor={p.iconColor as string}
          topLine={Boolean(p.topLine)}
          glowColor={p.glowColor as string}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
          headlineSlot={renderSlot(p.headline, legacyText(p.headline, { as: "h1", size: "lg", weight: "semibold" }))}
          subheadlineSlot={renderSlot(p.subheadline, legacyText(p.subheadline, { as: "p", size: "md" }))}
        />
      );

    case "BrandFooter":
      return (
        <BrandFooter
          key={id}
          brandText={p.brandText as string}
          tagline={p.tagline as string}
          brandFont={p.brandFont as "serif" | "sans"}
          brandColor={p.brandColor as string}
          taglineColor={p.taglineColor as string}
          background={p.background as string}
          paddingY={p.paddingY as string}
          className={(p.className as string) || undefined}
          customCss={(p.customCss as string) || ""}
        />
      );

    // ── Campaign-specific primitives ──────────────────────────────────────────

    case "campaign-form":
      return <CampaignFormWidget key={id} p={p} ctx={ctx} cs={cs} />;

    case "campaign-choice":
      return renderCampaignChoice(id, p, ctx, cs);

    case "campaign-data-field":
      return renderDataField(id, p, ctx);

    case "campaign-conversion-button":
      return <ConversionButtonWidget key={id} id={id} p={p} ctx={ctx} cs={cs} />;

    case "audience-lookup":
      return <AudienceLookupWidget key={id} id={id} p={p} ctx={ctx} cs={cs} />;

    case "campaign-auto-advance":
      return <AutoAdvanceWidget key={id} ctx={ctx} />;

    default:
      return null;
  }
}

// ─── Auto-advance widget ──────────────────────────────────────────────────────
// Silently POSTs to the submit endpoint on mount, advancing the flow without
// user interaction. Used on gateway/routing pages (e.g. entry → offer branch).

function AutoAdvanceWidget({ ctx }: { ctx: RendererContext }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const submitted = React.useRef(false);

  // CampaignPageShell re-renders this component when the session is ready,
  // so ctx.sessionId transitions null → string. Fire the submit then — but only
  // once per session+page, so a flow that redirects back here can't loop.
  React.useEffect(() => {
    if (!ctx.sessionId || submitted.current) return;
    const key = `aa:${ctx.campaignSlug}:${ctx.pagePath}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* sessionStorage unavailable — fall through and fire once */ }
    submitted.current = true;
    formRef.current?.submit();
  }, [ctx.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitUrl = `/api/public/${ctx.orgSlug}/${ctx.campaignSlug}/submit`;
  return (
    <form ref={formRef} method="POST" action={submitUrl} style={{ display: "none" }}>
      <input type="hidden" name="_sessionId" value={ctx.sessionId ?? ""} />
      <input type="hidden" name="_conversionTrigger" value="0" />
    </form>
  );
}

// ─── Audience lookup widget ───────────────────────────────────────────────────

function AudienceLookupWidget({
  id,
  p,
  ctx,
  cs,
}: {
  id: string;
  p: Record<string, unknown>;
  ctx: RendererContext;
  cs: CampaignStyles;
}) {
  const [value, setValue] = React.useState("");

  // If the session's audience record is already activated, start in already_used state
  // so revisiting the page immediately shows the right message without re-entry.
  const sessionAlreadyActivated = Boolean(
    ctx.audienceRecord?.fields?.["_activated_at"]
  );
  const [status, setStatus] = React.useState<"idle" | "loading" | "error" | "already_used">(
    sessionAlreadyActivated ? "already_used" : "idle"
  );

  const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
  const fieldInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit", ...cs.cardRadius };
  const btnStyle: React.CSSProperties = { fontFamily: "inherit", ...cs.action, ...cs.font, ...cs.btnRadius };

  const errorMessage = (p.errorMessage as string) || "Code not found. Please try again.";
  const alreadyUsedMessage = (p.alreadyUsedMessage as string) || "You already activated your offer.";
  const successPath = (p.successPath as string)?.trim() || "";
  const identifyOnly = Boolean(p.identifyOnly);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setStatus("loading");
    try {
      // Collect current URL search params so the server can evaluate flow branching correctly
      const urlParams = Object.fromEntries(new URLSearchParams(window.location.search));
      const res = await fetch(
        `/api/public/${ctx.orgSlug}/${ctx.campaignSlug}/lookup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lookupKey: value.trim(),
            sessionId: ctx.sessionId,
            pageContext: { title: ctx.pageTitle, path: ctx.pagePath },
            urlParams,
            identifyOnly,
          }),
        }
      );
      const data = await res.json();
      if (data.valid) {
        // Prefer nextPath from the server (flow-resolved); fall back to successPath or same page
        const resolvedPath: string = data.nextPath ?? (successPath || null) ?? null;
        let dest: string;
        if (resolvedPath) {
          const normalizedPath = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
          const base = `/${ctx.orgSlug}/${ctx.campaignSlug}${normalizedPath}`;
          // Preserve existing URL search params (e.g. ?product=1)
          const search = window.location.search;
          dest = search ? `${base}${search}` : base;
        } else {
          dest = window.location.href;
        }
        window.location.href = dest;
      } else if (data.reason === "already_used") {
        setStatus("already_used");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "0 24px",
    width: "100%",
  };

  if (status === "already_used") {
    return (
      <div key={id} id={id} style={containerStyle}>
        <Text style={{ color: "inherit", fontFamily: "inherit" }}>
          {alreadyUsedMessage}
        </Text>
      </div>
    );
  }

  return (
    <div key={id} id={id} style={containerStyle}>
    <form onSubmit={handleSubmit}>
      <Stack direction="vertical" size="md">
        <Input
          name="lookupKey"
          label={(p.label as string) || "Enter your access code"}
          placeholder={(p.placeholder as string) || "Access code"}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          tone={status === "error" ? "danger" : "neutral"}
          error={status === "error" ? errorMessage : undefined}
          labelStyle={textInherit}
          inputStyle={fieldInherit}
          descriptionStyle={textInherit}
        />
        <Button type="submit" appearance="solid" tone="action" disabled={status === "loading"} style={btnStyle}>
          {status === "loading" ? "Checking…" : ((p.buttonLabel as string) || "Unlock")}
        </Button>
      </Stack>
    </form>
    </div>
  );
}

// ─── Campaign-specific renderers ──────────────────────────────────────────────

function CampaignFormWidget({
  p,
  ctx,
  cs,
}: {
  p: Record<string, unknown>;
  ctx: RendererContext;
  cs: CampaignStyles;
}): React.ReactNode {
  const inPageForm = React.useContext(PageFormContext);
  const fields = (p.fields as Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
  }>) ?? [];

  const actionUrl = `/api/public/${ctx.orgSlug}/${ctx.campaignSlug}/submit`;
  const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
  const fieldInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit", ...cs.cardRadius };
  const btnStyle: React.CSSProperties = { fontFamily: "inherit", ...cs.action, ...cs.font, ...cs.btnRadius };
  const conv = p.conversionTrigger ? "1" : "0";

  const fieldEls = (
    <Stack direction="vertical" size="md">
        {fields.map((field) =>
          field.type === "select" ? (
            <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: "6px", ...textInherit }}>
              {field.label}
              <select
                name={field.key}
                required={field.required}
                defaultValue=""
                style={{
                  ...fieldInherit,
                  border: "1px solid",
                  padding: "9px 12px",
                  fontSize: "14px",
                  backgroundColor: "transparent",
                  fontFamily: "inherit",
                }}
              >
                <option value="" disabled>
                  {field.placeholder || "Choose…"}
                </option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : field.type === "textarea" ? (
            <Textarea
              key={field.key}
              name={field.key}
              label={field.label}
              placeholder={field.placeholder}
              required={field.required}
              labelStyle={textInherit}
              textareaStyle={fieldInherit}
              descriptionStyle={textInherit}
            />
          ) : (
            <Input
              key={field.key}
              name={field.key}
              label={field.label}
              placeholder={field.placeholder}
              required={field.required}
              type={field.type === "phone" ? "tel" : field.type}
              labelStyle={textInherit}
              inputStyle={fieldInherit}
              descriptionStyle={textInherit}
            />
          )
        )}
        <Button
          type="submit"
          {...(inPageForm
            ? { formAction: `${actionUrl}?_conversionTrigger=${conv}&_triggerType=form_submit`, formMethod: "post" as const }
            : {})}
          appearance="solid"
          tone="action"
          style={btnStyle}
        >
          {(p.buttonLabel as string) || "Submit"}
        </Button>
      </Stack>
  );

  // Inside the page form: contribute fields + submit directly (no nested form).
  if (inPageForm) return fieldEls;

  // Standalone: render our own form.
  return (
    <form method="POST" action={actionUrl} style={{ display: "contents" }}>
      <input type="hidden" name="_sessionId" value={ctx.sessionId ?? ""} />
      <input type="hidden" name="_conversionTrigger" value={conv} />
      {fieldEls}
    </form>
  );
}

function renderCampaignChoice(
  id: string,
  p: Record<string, unknown>,
  ctx: RendererContext,
  cs: CampaignStyles
): React.ReactNode {
  const options = (p.options as Array<{ label: string; value: string }>) ?? [];
  const inputType = (p.inputType as string) || "radio";
  const fieldKey = (p.fieldKey as string) || id;
  const currentValue = ctx.formData[fieldKey];

  const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };

  return (
    <div key={id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Boolean(p.label) && (
        <Text size="sm" weight="medium" style={textInherit}>
          {p.label as string}
        </Text>
      )}
      {inputType === "select" ? (
        <select
          name={fieldKey}
          defaultValue={currentValue as string}
          style={{
            border: "1px solid",
            borderRadius: cs.cardRadius.borderRadius,
            padding: "9px 12px",
            color: "inherit",
            fontFamily: "inherit",
            fontSize: "14px",
            backgroundColor: "transparent",
          }}
        >
          <option value="">Choose…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        options.map((opt) => (
          <label
            key={opt.value}
            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
          >
            <input
              type={inputType}
              name={fieldKey}
              value={opt.value}
              defaultChecked={
                inputType === "checkbox"
                  ? Array.isArray(currentValue) && (currentValue as string[]).includes(opt.value)
                  : currentValue === opt.value
              }
            />
            <Text size="sm" style={textInherit}>{opt.label}</Text>
          </label>
        ))
      )}
    </div>
  );
}

function renderDataField(
  id: string,
  p: Record<string, unknown>,
  ctx: RendererContext
): React.ReactNode {
  const fieldKey = p.fieldKey as string;
  const fallback = (p.fallback as string) ?? "";

  let value = fallback;
  if (ctx.audienceRecord && fieldKey) {
    const raw = ctx.audienceRecord.fields[fieldKey];
    if (raw !== null && raw !== undefined) value = String(raw);
  }

  return (
    <Text key={id} size={(p.size as "sm" | "md" | "lg") || "md"} style={{ color: "inherit", fontFamily: "inherit" }}>
      {value}
    </Text>
  );
}

function ConversionButtonWidget({
  id,
  p,
  ctx,
  cs,
}: {
  id: string;
  p: Record<string, unknown>;
  ctx: RendererContext;
  cs: CampaignStyles;
}): React.ReactNode {
  const inPageForm = React.useContext(PageFormContext);
  const submitUrl = `/api/public/${ctx.orgSlug}/${ctx.campaignSlug}/submit`;
  const targetUrl = p.navigateTo === "url" ? (p.targetUrl as string) : undefined;
  const btnStyle: React.CSSProperties = { fontFamily: "inherit", ...cs.action, ...cs.font, ...cs.btnRadius };
  const wrapStyle: React.CSSProperties = { display: "flex", justifyContent: "center", padding: "32px 24px 56px" };
  const label = (p.label as string) || "Continue";

  // Plain link — navigates to an external/explicit URL, no submission.
  if (targetUrl) {
    return (
      <div style={wrapStyle}>
        <a href={targetUrl}>
          <Button appearance="solid" tone="action" style={btnStyle}>
            {label}
          </Button>
        </a>
      </div>
    );
  }

  // Inside the page form: submit the whole page, carrying this button's
  // conversion metadata on its formAction query so multiple buttons differ.
  if (inPageForm) {
    const action = `${submitUrl}?_conversionTrigger=1&_triggerType=button_click&_triggerElementId=${encodeURIComponent(id)}`;
    return (
      <div style={wrapStyle}>
        <Button type="submit" formAction={action} formMethod="post" appearance="solid" tone="action" style={btnStyle}>
          {label}
        </Button>
      </div>
    );
  }

  // Standalone fallback (e.g. on a self-submitting page): own form.
  return (
    <div style={wrapStyle}>
      <form method="POST" action={submitUrl}>
        <input type="hidden" name="_sessionId" value={ctx.sessionId ?? ""} />
        <input type="hidden" name="_conversionTrigger" value="1" />
        <input type="hidden" name="_triggerType" value="button_click" />
        <input type="hidden" name="_triggerElementId" value={id} />
        <Button type="submit" appearance="solid" tone="action" style={btnStyle}>
          {label}
        </Button>
      </form>
    </div>
  );
}
