import React, { useRef, useEffect, useCallback } from "react";
import type { Config, DefaultComponentProps, Fields } from "@measured/puck";
import { DropZone } from "@measured/puck";
import {
  Box,
  Stack,
  Text,
  Button,
  Card,
  Badge,
  Input,
  Textarea,
} from "@twinaholic/react";
import {
  Square,
  Layers,
  Type as TypeIcon,
  MousePointerClick,
  CreditCard,
  Tag,
  TextCursorInput,
  AlignLeft,
  Image as ImageIcon,
  FileText,
  ClipboardList,
  ListChecks,
  Database,
  ArrowRightCircle,
  KeyRound,
} from "lucide-react";
import { useCampaignTheme, computeCampaignStyles } from "@/lib/builder/campaign-theme-context";
import { sanitizeRichText } from "@/lib/sanitize";
import { buildThemeVars, resolveFontFamily } from "@/lib/campaign-engine/theme";
import { campaignBlockConfigs } from "@/lib/builder/campaign-blocks";
import {
  colorField,
  spacingField,
  alignField,
  radiusField,
  dimensionField,
  customCssField,
  sectionField,
  imageField,
  omitFields,
  cssFields as buildCssFields,
  parseCustomCss,
  spacingToCss,
  SPACING_ZERO,
} from "@/lib/builder/inspector-fields";

// ─── Shared field helpers ─────────────────────────────────────────────────────
// Modern Inspector controls live in inspector-fields.tsx (imported above).
// `colorCssField` is kept as an alias so existing call sites read unchanged.
const colorCssField = colorField;

/** Build a style object from truthy CSS values, handling spacing objects */
function styleOverrides(props: Record<string, unknown>, keys: string[]): React.CSSProperties {
  const s: Record<string, string | number> = {};
  for (const k of keys) {
    const v = props[k];
    if (v === null || v === undefined || v === "") continue;
    if (k === "padding" || k === "margin") {
      const css = spacingToCss(v);
      if (css) s[k] = css;
      continue;
    }
    if (typeof v === "number") { s[k] = v; continue; }
    if (typeof v === "string" && v.trim()) s[k] = v.trim();
  }
  return s as React.CSSProperties;
}

// ─── Campaign theme style overrides ──────────────────────────────────────────
// @twinaholic/react resolves styles from the token catalog as concrete values,
// not CSS variables. To apply campaign branding, we pass inline style overrides
// via the `style` prop, which wins via mergeStyle({ ...resolved, ...style }).

function useCampaignStyles() {
  return computeCampaignStyles(useCampaignTheme());
}

// ─── Shared CSS field map (modern controls via the convention mapper) ─────────
// `background` is gradient-capable through the color popover; `borderRadius`
// uses the radius control; spacing uses the linked spacing control.
const cssFields = {
  _spacing: sectionField("Spacing"),
  ...buildCssFields(["padding", "margin"]),
  _size: sectionField("Size"),
  ...buildCssFields(["width", "maxWidth", "minHeight"]),
  _color: sectionField("Color"),
  ...buildCssFields(["backgroundColor", "color", "background"], { background: { label: "Background" } }),
  _border: sectionField("Border"),
  ...buildCssFields(["borderRadius", "border", "opacity"], { border: { label: "Border" } }),
  _advanced: sectionField("Advanced"),
  ...buildCssFields(["className", "customCss"]),
};

const CSS_KEYS = ["padding","margin","width","maxWidth","minHeight","backgroundColor","color","background","borderRadius","border","opacity"];

const sizeField = {
  type: "radio" as const,
  label: "Size",
  options: [
    { value: "sm", label: "SM" },
    { value: "md", label: "MD" },
    { value: "lg", label: "LG" },
  ],
};

const toneField = (options: string[]) => ({
  type: "select" as const,
  label: "Tone",
  options: options.map((v) => ({ value: v, label: v })),
});

const appearanceField = (options: string[]) => ({
  type: "select" as const,
  label: "Appearance",
  options: options.map((v) => ({ value: v, label: v })),
});

// ─── Component definitions ────────────────────────────────────────────────────

const BoxComponent = {
  label: "Box",
  icon: <Square size={16} />,
  fields: {
    _appearance: sectionField("Appearance"),
    size: sizeField,
    surface: {
      type: "select" as const,
      label: "Surface",
      options: [
        { value: "", label: "None" },
        { value: "canvas", label: "Canvas" },
        { value: "subtle", label: "Subtle" },
        { value: "sunken", label: "Sunken" },
        { value: "action", label: "Action" },
        { value: "success", label: "Success" },
        { value: "warning", label: "Warning" },
        { value: "danger", label: "Danger" },
      ],
    },
    emphasis: {
      type: "radio" as const,
      label: "Emphasis",
      options: [
        { value: "flat", label: "Flat" },
        { value: "outlined", label: "Outlined" },
        { value: "elevated", label: "Elevated" },
      ],
    },
    ...cssFields,
  },
  defaultProps: {
    size: "md",
    surface: "canvas",
    emphasis: "flat",
    padding: SPACING_ZERO, margin: SPACING_ZERO, width: "", maxWidth: "", minHeight: "",
    backgroundColor: "", color: "", background: "", borderRadius: "", border: "", opacity: "",
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps & { puck: { isEditing: boolean } }) => {
    const { size, surface, emphasis, puck } = props;
    const cs = useCampaignStyles();
    const css = styleOverrides(props, CSS_KEYS);
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;
    const surfaceOverride =
      surface === "canvas" ? cs.canvas :
      (surface === "subtle" || surface === "sunken") ? cs.surface :
      null;
    const style = {
      minHeight: puck?.isEditing && !css.minHeight ? 40 : undefined,
      ...surfaceOverride,
      ...cs.font,
      ...cs.cardRadius,
      ...css,
      ...extra,
    };
    const el = (
      <Box
        size={size as "sm" | "md" | "lg"}
        surface={(surface || undefined) as "canvas" | "subtle" | "sunken" | "action" | "success" | "warning" | "danger" | undefined}
        emphasis={emphasis as "flat" | "outlined" | "elevated"}
        style={style}
      >
        <DropZone zone="children" />
      </Box>
    );
    return cn ? <div className={cn}>{el}</div> : el;
  },
};

const StackComponent = {
  label: "Stack",
  icon: <Layers size={16} />,
  fields: {
    _appearance: sectionField("Layout"),
    direction: {
      type: "radio" as const,
      label: "Direction",
      options: [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
      ],
    },
    size: sizeField,
    align: {
      type: "select" as const,
      label: "Align",
      options: [
        { value: "start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "end", label: "End" },
        { value: "stretch", label: "Stretch" },
      ],
    },
    wrap: {
      type: "radio" as const,
      label: "Wrap",
      options: [
        { value: false, label: "No" },
        { value: true, label: "Yes" },
      ],
    },
    ...cssFields,
  },
  defaultProps: {
    direction: "vertical",
    size: "md",
    align: "stretch",
    wrap: false,
    padding: SPACING_ZERO, margin: SPACING_ZERO, width: "", maxWidth: "", minHeight: "",
    backgroundColor: "", color: "", background: "", borderRadius: "", border: "", opacity: "",
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps & { puck: { isEditing: boolean } }) => {
    const { direction, size, align, wrap, puck } = props;
    const cs = useCampaignStyles();
    const css = styleOverrides(props, CSS_KEYS);
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;
    const style = {
      minHeight: puck?.isEditing && !css.minHeight ? 40 : undefined,
      ...cs.font,
      ...css,
      ...extra,
    };
    const el = (
      <Stack
        direction={direction as "vertical" | "horizontal"}
        size={size as "sm" | "md" | "lg"}
        align={align as "start" | "center" | "end" | "stretch"}
        wrap={Boolean(wrap)}
        style={style}
      >
        <DropZone zone="children" />
      </Stack>
    );
    return cn ? <div className={cn}>{el}</div> : el;
  },
};

const TextComponent = {
  label: "Text",
  icon: <TypeIcon size={16} />,
  fields: {
    _content: sectionField("Content"),
    content: { type: "textarea" as const, label: "Content" },
    as: {
      type: "select" as const,
      label: "HTML tag",
      options: [
        { value: "p", label: "<p>" },
        { value: "h1", label: "<h1>" },
        { value: "h2", label: "<h2>" },
        { value: "h3", label: "<h3>" },
        { value: "h4", label: "<h4>" },
        { value: "span", label: "<span>" },
        { value: "label", label: "<label>" },
      ],
    },
    _typography: sectionField("Typography"),
    size: sizeField,
    tone: toneField(["primary", "secondary", "inverse", "action", "success", "warning", "danger"]),
    weight: {
      type: "radio" as const,
      label: "Weight",
      options: [
        { value: "regular", label: "Regular" },
        { value: "medium", label: "Medium" },
        { value: "semibold", label: "Semibold" },
      ],
    },
    color:      colorCssField("Color (override)"),
    fontSize:   dimensionField("Font size"),
    textAlign:  alignField("Align", ["left", "center", "right", "justify"]),
    lineHeight: dimensionField("Line height"),
    _spacing: sectionField("Spacing"),
    padding:    spacingField("Padding"),
    margin:     spacingField("Margin"),
    _advanced: sectionField("Advanced"),
    className:  { type: "text" as const, label: "CSS class" },
    customCss:  customCssField,
  },
  defaultProps: {
    content: "Your text here",
    size: "md",
    tone: "primary",
    weight: "regular",
    as: "p",
    color: "", fontSize: "", textAlign: "", lineHeight: "",
    padding: SPACING_ZERO, margin: SPACING_ZERO,
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps) => {
    const { content, size, tone, weight, as: tag, color, fontSize, textAlign, lineHeight } = props;
    const cs = useCampaignStyles();
    const applyText = tone === "primary" || tone === "secondary";
    const styleOvr: React.CSSProperties = {
      // Inherit as base so token-resolved inline styles don't block CSS cascade
      color: "inherit",
      fontFamily: "inherit",
      // Campaign theme overrides inherit (only for primary/secondary tones)
      ...(applyText ? cs.text : null),
      // User explicit values win over everything
      ...(color && { color: color as string }),
      ...(fontSize && { fontSize: fontSize as string }),
      ...(textAlign && { textAlign: textAlign as React.CSSProperties["textAlign"] }),
      ...(lineHeight && { lineHeight: lineHeight as string }),
      ...(spacingToCss(props.padding) ? { padding: spacingToCss(props.padding) } : {}),
      ...(spacingToCss(props.margin) ? { margin: spacingToCss(props.margin) } : {}),
      ...parseCustomCss((props.customCss as string) || ""),
    };
    const cn = (props.className as string) || undefined;
    const el = (
      <Text
        as={tag as React.ElementType}
        size={size as "sm" | "md" | "lg"}
        tone={tone as "primary" | "secondary" | "inverse" | "action" | "success" | "warning" | "danger"}
        weight={weight as "regular" | "medium" | "semibold"}
        style={styleOvr}
      >
        {content as string}
      </Text>
    );
    return cn ? <div className={cn}>{el}</div> : el;
  },
};

const ButtonComponent = {
  label: "Button",
  icon: <MousePointerClick size={16} />,
  fields: {
    _content: sectionField("Content"),
    label: { type: "text" as const, label: "Label" },
    _style: sectionField("Style"),
    size: sizeField,
    appearance: appearanceField(["solid", "outline", "ghost"]),
    tone: toneField(["action", "success", "warning", "danger", "neutral"]),
    background:   colorCssField("Background (override)"),
    color:        colorCssField("Color (override)"),
    borderRadius: radiusField("Border radius"),
    _spacing: sectionField("Spacing"),
    padding:      spacingField("Padding"),
    width:        dimensionField("Width"),
    _advanced: sectionField("Advanced"),
    className:    { type: "text" as const, label: "CSS class" },
    customCss:    customCssField,
  },
  defaultProps: {
    label: "Click me",
    size: "md",
    appearance: "solid",
    tone: "action",
    background: "", color: "", borderRadius: "", padding: SPACING_ZERO, width: "",
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps) => {
    const { label, size, appearance, tone } = props;
    const cs = useCampaignStyles();
    const css = styleOverrides(props, ["background", "color", "borderRadius", "padding", "width"]);
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;
    const themeBase: React.CSSProperties = {
      fontFamily: "inherit",  // let campaign font cascade from parent
      ...(tone === "action" && appearance === "solid" ? cs.action : null),
      ...cs.font,             // campaign font overrides inherit if set
      ...cs.btnRadius,
    };
    const el = (
      <Button
        size={size as "sm" | "md" | "lg"}
        appearance={appearance as "solid" | "outline" | "ghost"}
        tone={tone as "action" | "success" | "warning" | "danger" | "neutral"}
        style={{ ...themeBase, ...css, ...extra }}
      >
        {label as string}
      </Button>
    );
    return cn ? <div className={cn}>{el}</div> : el;
  },
};

const CardComponent = {
  label: "Card",
  icon: <CreditCard size={16} />,
  fields: {
    _appearance: sectionField("Appearance"),
    size: sizeField,
    surface: {
      type: "select" as const,
      label: "Surface",
      options: ["canvas", "subtle", "sunken", "action", "success", "warning", "danger"].map(
        (v) => ({ value: v, label: v })
      ),
    },
    emphasis: {
      type: "radio" as const,
      label: "Emphasis",
      options: [
        { value: "flat", label: "Flat" },
        { value: "outlined", label: "Outlined" },
        { value: "elevated", label: "Elevated" },
      ],
    },
    ...cssFields,
  },
  defaultProps: {
    size: "md",
    surface: "canvas",
    emphasis: "outlined",
    padding: SPACING_ZERO, margin: SPACING_ZERO, width: "", maxWidth: "", minHeight: "",
    backgroundColor: "", color: "", background: "", borderRadius: "", border: "", opacity: "",
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps) => {
    const { size, surface, emphasis } = props;
    const cs = useCampaignStyles();
    const css = styleOverrides(props, CSS_KEYS);
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;
    const surfaceOverride =
      surface === "canvas" ? cs.canvas :
      (surface === "subtle" || surface === "sunken") ? cs.surface :
      null;
    const slotInherit = { style: { color: "inherit", fontFamily: "inherit" } };
    const el = (
      <Card
        size={size as "sm" | "md" | "lg"}
        surface={surface as "canvas" | "subtle" | "sunken" | "action" | "success" | "warning" | "danger"}
        emphasis={emphasis as "flat" | "outlined" | "elevated"}
        style={{ ...surfaceOverride, ...cs.cardRadius, ...css, ...extra }}
        slotProps={{ header: slotInherit, body: slotInherit, footer: slotInherit }}
      >
        <DropZone zone="children" />
      </Card>
    );
    return cn ? <div className={cn}>{el}</div> : el;
  },
};

const BadgeComponent = {
  label: "Badge",
  icon: <Tag size={16} />,
  fields: {
    _content: sectionField("Content"),
    content: { type: "text" as const, label: "Label" },
    _style: sectionField("Style"),
    size: sizeField,
    tone: toneField(["neutral", "action", "success", "warning", "danger"]),
    appearance: appearanceField(["solid", "soft", "outline"]),
    _advanced: sectionField("Advanced"),
    className: { type: "text" as const, label: "CSS class" },
    customCss: customCssField,
  },
  defaultProps: {
    content: "New",
    size: "md",
    tone: "action",
    appearance: "soft",
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps) => {
    const { content, size, tone, appearance } = props;
    const cs = useCampaignStyles();
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;
    const themeBase: React.CSSProperties = {
      fontFamily: "inherit",  // base: let campaign font cascade
      // Non-action tones: let text color cascade (action keeps its semantic white foreground)
      ...(tone !== "action" ? { color: "inherit" } : {}),
      ...(tone === "action" ? cs.action : null),  // accent bg+border for action
      ...cs.font,     // explicit campaign font overrides inherit
      ...cs.btnRadius, // badge uses same radius token as button
    };
    const el = (
      <Badge
        size={size as "sm" | "md" | "lg"}
        tone={tone as "neutral" | "action" | "success" | "warning" | "danger"}
        appearance={appearance as "solid" | "soft" | "outline"}
        style={{ ...themeBase, ...extra }}
      >
        {content as string}
      </Badge>
    );
    return cn ? <div className={cn}>{el}</div> : el;
  },
};

const InputComponent = {
  label: "Input",
  icon: <TextCursorInput size={16} />,
  fields: {
    label: { type: "text" as const, label: "Label" },
    placeholder: { type: "text" as const, label: "Placeholder" },
    description: { type: "text" as const, label: "Description" },
    name: { type: "text" as const, label: "Field name (for forms)" },
    size: sizeField,
    appearance: appearanceField(["outline", "filled"]),
    tone: toneField(["neutral", "success", "danger"]),
    inputType: {
      type: "select" as const,
      label: "Input type",
      options: [
        { value: "text", label: "Text" },
        { value: "email", label: "Email" },
        { value: "tel", label: "Phone" },
        { value: "number", label: "Number" },
        { value: "date", label: "Date" },
        { value: "password", label: "Password" },
      ],
    },
  },
  defaultProps: {
    label: "Label",
    placeholder: "Enter value…",
    description: "",
    name: "field",
    size: "md",
    appearance: "outline",
    tone: "neutral",
    inputType: "text",
  },
  render: ({ label, placeholder, description, name, size, appearance, tone, inputType }: DefaultComponentProps) => {
    const cs = useCampaignStyles();
    const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
    const fieldInherit: React.CSSProperties = {
      color: "inherit",
      fontFamily: "inherit",
      ...(cs.cardRadius),  // campaign radius on input field
    };
    return (
      <Input
        label={label as string}
        placeholder={placeholder as string}
        description={(description as string) || undefined}
        name={name as string}
        type={inputType as string}
        size={size as "sm" | "md" | "lg"}
        appearance={appearance as "outline" | "filled"}
        tone={tone as "neutral" | "success" | "danger"}
        labelStyle={textInherit}
        inputStyle={fieldInherit}
        descriptionStyle={textInherit}
      />
    );
  },
};

const TextareaComponent = {
  label: "Textarea",
  icon: <AlignLeft size={16} />,
  fields: {
    label: { type: "text" as const, label: "Label" },
    placeholder: { type: "text" as const, label: "Placeholder" },
    description: { type: "text" as const, label: "Description" },
    name: { type: "text" as const, label: "Field name (for forms)" },
    size: sizeField,
    appearance: appearanceField(["outline", "filled"]),
    rows: {
      type: "number" as const,
      label: "Rows",
      min: 2,
      max: 20,
    },
  },
  defaultProps: {
    label: "Message",
    placeholder: "Enter your message…",
    description: "",
    name: "message",
    size: "md",
    appearance: "outline",
    rows: 4,
  },
  render: ({ label, placeholder, description, name, size, appearance, rows }: DefaultComponentProps) => {
    const cs = useCampaignStyles();
    const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
    const fieldInherit: React.CSSProperties = {
      color: "inherit",
      fontFamily: "inherit",
      ...(cs.cardRadius),
    };
    return (
      <Textarea
        label={label as string}
        placeholder={placeholder as string}
        description={(description as string) || undefined}
        name={name as string}
        size={size as "sm" | "md" | "lg"}
        appearance={appearance as "outline" | "filled"}
        rows={rows as number}
        labelStyle={textInherit}
        textareaStyle={fieldInherit}
        descriptionStyle={textInherit}
      />
    );
  },
};

const ImageComponent = {
  label: "Image",
  icon: <ImageIcon size={16} />,
  fields: {
    _source: sectionField("Source"),
    src: imageField("Image"),
    alt: { type: "text" as const, label: "Alt text" },
    _size: sectionField("Size & fit"),
    width: dimensionField("Width"),
    height: dimensionField("Height"),
    objectFit: {
      type: "select" as const,
      label: "Object fit",
      options: [
        { value: "cover", label: "Cover" },
        { value: "contain", label: "Contain" },
        { value: "fill", label: "Fill" },
      ],
    },
    _style: sectionField("Style"),
    borderRadius: radiusField("Border radius"),
    opacity:      { type: "number" as const, label: "Opacity", min: 0, max: 1, step: 0.01 },
    _advanced: sectionField("Advanced"),
    className:    { type: "text" as const, label: "CSS class" },
    customCss:    customCssField,
  },
  defaultProps: {
    src: "",
    alt: "",
    width: "100%",
    height: "auto",
    objectFit: "cover",
    borderRadius: "", opacity: "",
    className: "", customCss: "",
  },
  render: (props: DefaultComponentProps) => {
    const { src, alt, width, height, objectFit } = props;
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;

    if (!src) {
      return (
        <div
          className={cn}
          style={{
            width: (width as string) || "100%",
            height: (height as string) || 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1a1a2a",
            border: "2px dashed #3a3a4a",
            borderRadius: (props.borderRadius as string) || 6,
            color: "#606070",
            fontSize: 12,
            ...extra,
          }}
        >
          Image URL not set
        </div>
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src as string}
        alt={alt as string}
        className={cn}
        style={{
          width: (width as string) || "100%",
          height: (height as string) || "auto",
          objectFit: objectFit as "cover" | "contain" | "fill",
          display: "block",
          ...(props.borderRadius && { borderRadius: props.borderRadius as string }),
          ...(props.opacity !== "" && props.opacity !== undefined ? { opacity: props.opacity as number } : {}),
          ...extra,
        }}
      />
    );
  },
};

// ─── Campaign-specific components (builder preview only) ─────────────────────
// These are rendered by PrimitiveRenderer server-side with real session data.
// In the builder they show a structural placeholder so authors can compose them.

const CampaignFormComponent = {
  label: "Form",
  icon: <ClipboardList size={16} />,
  fields: {
    buttonLabel: { type: "text" as const, label: "Submit button label" },
    conversionTrigger: {
      type: "radio" as const,
      label: "Record conversion on submit",
      options: [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
      ],
    },
    fields: {
      type: "array" as const,
      label: "Fields",
      arrayFields: {
        key: { type: "text" as const, label: "Field key" },
        label: { type: "text" as const, label: "Label" },
        type: {
          type: "select" as const,
          label: "Type",
          options: ["text", "email", "phone", "number", "date", "textarea"].map(
            (v) => ({ value: v, label: v })
          ),
        },
        placeholder: { type: "text" as const, label: "Placeholder" },
        required: {
          type: "radio" as const,
          label: "Required",
          options: [
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ],
        },
      },
    },
  },
  defaultProps: {
    buttonLabel: "Submit",
    conversionTrigger: true,
    fields: [{ key: "email", label: "Email", type: "email", placeholder: "you@example.com", required: true }],
  },
  render: ({ fields: formFields, buttonLabel }: DefaultComponentProps) => {
    const fieldList = (formFields as Array<{ key: string; label: string; type: string; placeholder?: string; required?: boolean }>) ?? [];
    const cs = useCampaignStyles();
    const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
    const fieldInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit", ...cs.cardRadius };
    return (
      <Stack direction="vertical" size="md">
        {fieldList.map((f) =>
          f.type === "textarea" ? (
            <Textarea
              key={f.key}
              label={f.label}
              placeholder={f.placeholder}
              name={f.key}
              labelStyle={textInherit}
              textareaStyle={fieldInherit}
              descriptionStyle={textInherit}
            />
          ) : (
            <Input
              key={f.key}
              label={f.label}
              placeholder={f.placeholder}
              type={f.type === "phone" ? "tel" : f.type}
              name={f.key}
              labelStyle={textInherit}
              inputStyle={fieldInherit}
              descriptionStyle={textInherit}
            />
          )
        )}
        <Button appearance="solid" tone="action" style={{ fontFamily: "inherit", ...cs.action, ...cs.font, ...cs.btnRadius }}>
          {(buttonLabel as string) || "Submit"}
        </Button>
      </Stack>
    );
  },
};

const CampaignChoiceComponent = {
  label: "Choice",
  icon: <ListChecks size={16} />,
  fields: {
    fieldKey: { type: "text" as const, label: "Field key" },
    label: { type: "text" as const, label: "Label" },
    inputType: {
      type: "radio" as const,
      label: "Input type",
      options: [
        { value: "radio", label: "Radio" },
        { value: "checkbox", label: "Checkbox" },
        { value: "select", label: "Select" },
      ],
    },
    options: {
      type: "array" as const,
      label: "Options",
      arrayFields: {
        label: { type: "text" as const, label: "Label" },
        value: { type: "text" as const, label: "Value" },
      },
    },
    conversionTrigger: {
      type: "radio" as const,
      label: "Record conversion on select",
      options: [{ value: true, label: "Yes" }, { value: false, label: "No" }],
    },
  },
  defaultProps: {
    fieldKey: "choice",
    label: "Choose an option",
    inputType: "radio",
    options: [
      { label: "Option A", value: "a" },
      { label: "Option B", value: "b" },
    ],
    conversionTrigger: false,
  },
  render: ({ label, options, inputType }: DefaultComponentProps) => {
    const opts = (options as Array<{ label: string; value: string }>) ?? [];
    const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
    return (
      <Stack direction="vertical" size="sm">
        {label && <Text size="sm" weight="medium" style={textInherit}>{label as string}</Text>}
        {opts.map((opt) => (
          <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
            <input type={(inputType as string) || "radio"} name="choice" value={opt.value} readOnly />
            <Text size="sm" style={textInherit}>{opt.label}</Text>
          </label>
        ))}
      </Stack>
    );
  },
};

const CampaignDataFieldComponent = {
  label: "Data field",
  icon: <Database size={16} />,
  fields: {
    fieldKey: { type: "text" as const, label: "Audience field key" },
    fallback: { type: "text" as const, label: "Fallback text (no match)" },
    size: sizeField,
  },
  defaultProps: { fieldKey: "", fallback: "", size: "md" },
  render: ({ fieldKey, fallback, size }: DefaultComponentProps) => (
    <Text
      size={size as "sm" | "md" | "lg"}
      style={{ color: "inherit", fontFamily: "inherit" }}
    >
      {fieldKey ? `{{ record.${fieldKey as string} }}` : (fallback as string) || "—"}
    </Text>
  ),
};

const CampaignConversionButtonComponent = {
  label: "Conversion button",
  icon: <ArrowRightCircle size={16} />,
  fields: {
    label: { type: "text" as const, label: "Label" },
    navigateTo: {
      type: "radio" as const,
      label: "Navigate to",
      options: [
        { value: "next", label: "Next page in flow" },
        { value: "url", label: "Custom URL" },
      ],
    },
    targetUrl: { type: "text" as const, label: "Target URL" },
  },
  resolveFields: (data: { props?: Record<string, unknown> }, { fields }: { fields: Fields }) =>
    data.props?.navigateTo === "url" ? fields : omitFields(fields, ["targetUrl"]),
  defaultProps: { label: "Continue", navigateTo: "next", targetUrl: "" },
  render: ({ label }: DefaultComponentProps) => {
    const cs = useCampaignStyles();
    return (
      <Button appearance="solid" tone="action" style={{ fontFamily: "inherit", ...cs.action, ...cs.font, ...cs.btnRadius }}>
        {(label as string) || "Continue"}
      </Button>
    );
  },
};

const AudienceLookupComponent = {
  label: "Audience lookup",
  icon: <KeyRound size={16} />,
  fields: {
    label: { type: "text" as const, label: "Label" },
    placeholder: { type: "text" as const, label: "Placeholder" },
    buttonLabel: { type: "text" as const, label: "Button label" },
    errorMessage: { type: "text" as const, label: "Error message (no match)" },
    alreadyUsedMessage: { type: "text" as const, label: "Already activated message" },
    successPath: { type: "text" as const, label: "Redirect path on success (e.g. /thank-you)" },
    identifyOnly: {
      type: "radio" as const, label: "Mode",
      options: [{ value: false, label: "Activate (stamps used)" }, { value: true, label: "Identify only (no activation)" }],
    },
  },
  defaultProps: {
    label: "Enter your access code",
    placeholder: "Access code",
    buttonLabel: "Unlock",
    errorMessage: "Code not found. Please try again.",
    alreadyUsedMessage: "This code has already been activated.",
    successPath: "",
    identifyOnly: false,
  },
  render: ({ label, placeholder, buttonLabel }: DefaultComponentProps) => {
    const cs = useCampaignStyles();
    const textInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit" };
    const fieldInherit: React.CSSProperties = { color: "inherit", fontFamily: "inherit", ...cs.cardRadius };
    return (
      <Stack direction="vertical" size="md">
        <Input
          label={label as string}
          placeholder={placeholder as string}
          name="lookupKey"
          labelStyle={textInherit}
          inputStyle={fieldInherit}
          descriptionStyle={textInherit}
        />
        <Button appearance="solid" tone="action" style={{ fontFamily: "inherit", ...cs.action, ...cs.font, ...cs.btnRadius }}>
          {(buttonLabel as string) || "Unlock"}
        </Button>
      </Stack>
    );
  },
};

// ─── Rich Text ───────────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);

  // Set initial HTML once on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || "<p></p>";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const ToolBtn = ({ cmd, arg, children, title }: { cmd: string; arg?: string; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, arg); }}
      style={toolBtnStyle}
    >
      {children}
    </button>
  );

  return (
    <div style={rtWrap}>
      <div style={toolbar}>
        <ToolBtn cmd="bold" title="Bold"><b>B</b></ToolBtn>
        <ToolBtn cmd="italic" title="Italic"><i>I</i></ToolBtn>
        <ToolBtn cmd="underline" title="Underline"><u>U</u></ToolBtn>
        <span style={toolDivider} />
        <ToolBtn cmd="formatBlock" arg="h1" title="Heading 1">H1</ToolBtn>
        <ToolBtn cmd="formatBlock" arg="h2" title="Heading 2">H2</ToolBtn>
        <ToolBtn cmd="formatBlock" arg="h3" title="Heading 3">H3</ToolBtn>
        <ToolBtn cmd="formatBlock" arg="p" title="Paragraph">¶</ToolBtn>
        <span style={toolDivider} />
        <ToolBtn cmd="insertUnorderedList" title="Bullet list">•—</ToolBtn>
        <ToolBtn cmd="insertOrderedList" title="Numbered list">1.</ToolBtn>
        <span style={toolDivider} />
        <ToolBtn cmd="removeFormat" title="Clear formatting">✕</ToolBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => {
          isComposing.current = false;
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        onInput={() => {
          if (!isComposing.current && editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        style={rtEditor}
      />
    </div>
  );
}

const rtWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 0, border: "1px solid #3a3a4a", borderRadius: 6, overflow: "hidden" };
const toolbar: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 2, padding: "4px 6px", background: "#1a1a2a", borderBottom: "1px solid #3a3a4a" };
const toolBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#a0a0c0", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 6px", borderRadius: 3, minWidth: 24, textAlign: "center" };
const toolDivider: React.CSSProperties = { width: 1, height: 18, background: "#3a3a4a", margin: "0 2px", alignSelf: "center" };
const rtEditor: React.CSSProperties = { minHeight: 120, padding: "10px 12px", outline: "none", fontSize: 14, lineHeight: 1.6, color: "#e0e0f0", background: "#13131f" };

const RichTextComponent = {
  label: "Rich Text",
  icon: <FileText size={16} />,
  fields: {
    content: {
      type: "custom" as const,
      label: "Content",
      render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
        <RichTextEditor value={(value as string) || "<p></p>"} onChange={onChange} />
      ),
    },
    padding:    spacingField("Padding"),
    margin:     spacingField("Margin"),
    maxWidth:   dimensionField("Max width"),
    color:      colorCssField("Text color"),
    fontSize:   dimensionField("Font size"),
    lineHeight: dimensionField("Line height"),
    textAlign:  alignField("Align", ["left", "center", "right", "justify"]),
    className:  { type: "text" as const, label: "CSS class" },
    customCss:  customCssField,
  },
  defaultProps: { content: "<p>Your content here</p>", padding: SPACING_ZERO, margin: SPACING_ZERO, maxWidth: "", color: "", fontSize: "", lineHeight: "", textAlign: "", className: "", customCss: "" },
  render: (props: DefaultComponentProps) => {
    const { content } = props;
    const css = styleOverrides(props, ["padding", "margin", "maxWidth", "color", "fontSize", "lineHeight", "textAlign"]);
    const extra = parseCustomCss((props.customCss as string) || "");
    const cn = (props.className as string) || undefined;
    return (
      <div
        className={["primitive-richtext", cn].filter(Boolean).join(" ")}
        style={{ color: "inherit", fontFamily: "inherit", lineHeight: 1.7, ...css, ...extra }}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText((content as string) || "") }}
      />
    );
  },
};

// ─── Root config ──────────────────────────────────────────────────────────────

export const puckConfig: Config = {
  root: {
    fields: {
      title: { type: "text", label: "Page title" },
      backgroundColor: colorCssField("Background color"),
    },
    defaultProps: {
      title: "",
      backgroundColor: "",
    },
    render: ({ children, backgroundColor }: DefaultComponentProps & { children: React.ReactNode }) => {
      const theme = useCampaignTheme();
      const cs = computeCampaignStyles(theme);
      // Puck renders inside an iframe, so the --campaign-* vars set on the
      // BuilderClient wrapper (outside the iframe) don't reach the blocks here.
      // Re-apply them on the canvas root so density / fonts match the live page.
      const themeVars = theme ? buildThemeVars(theme) : {};
      const fontFamily = theme ? resolveFontFamily(theme.fontFamily) : undefined;
      return (
        <div
          style={{
            minHeight: "100vh",
            ...themeVars,
            ...(fontFamily ? { fontFamily } : {}),
            ...(theme?.textColor ? { color: theme.textColor } : {}),
            ...cs.canvas,
            ...(backgroundColor ? { backgroundColor: backgroundColor as string } : {}),
          }}
        >
          {children}
        </div>
      );
    },
  },
  categories: {
    "campaign-blocks": {
      title: "Campaign blocks",
      components: ["CampaignNav", "Hero", "SectionWrap", "TierGrid", "TierCard", "FeatureList", "Divider", "StepItem", "SuccessHeader", "BrandFooter"],
      defaultExpanded: true,
    },
    "layout": {
      title: "Layout",
      components: ["Box", "Stack"],
    },
    "content": {
      title: "Content",
      components: ["Text", "Button", "Card", "Badge", "Image", "RichText"],
    },
    "forms": {
      title: "Forms & interactions",
      components: ["Input", "Textarea", "campaign-form", "campaign-choice", "campaign-data-field", "campaign-conversion-button", "audience-lookup"],
    },
  },
  components: {
    Box: BoxComponent,
    Stack: StackComponent,
    Text: TextComponent,
    Button: ButtonComponent,
    Card: CardComponent,
    Badge: BadgeComponent,
    Input: InputComponent,
    Textarea: TextareaComponent,
    Image: ImageComponent,
    RichText: RichTextComponent,
    // Campaign-specific
    "campaign-form": CampaignFormComponent,
    "campaign-choice": CampaignChoiceComponent,
    "campaign-data-field": CampaignDataFieldComponent,
    "campaign-conversion-button": CampaignConversionButtonComponent,
    "audience-lookup": AudienceLookupComponent,
    // Campaign block organisms
    ...campaignBlockConfigs,
  },
};
