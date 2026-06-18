"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  FONT_OPTIONS,
  HEADING_FONT_OPTIONS,
  resolveHeadingFontFamily,
  resolveFontFamily,
  getFontGoogleParam,
  getHeadingFontGoogleParam,
  resolveBrand,
  type CampaignTheme,
} from "@/lib/campaign-engine/theme";

/**
 * Controlled brand-token editor shared by Org Settings (the base brand) and the
 * campaign Branding tab (overrides). When `inherited` is provided, unset fields
 * show their inherited value and the preview reflects the resolved cascade.
 */
export function BrandingEditor({
  value,
  onChange,
  inherited,
}: {
  value: CampaignTheme;
  onChange: (next: CampaignTheme) => void;
  inherited?: CampaignTheme | null;
}) {
  const effective = inherited ? resolveBrand(inherited, value) : value;
  const bodyFontParam = getFontGoogleParam(effective.fontFamily);
  const headingFontParam = getHeadingFontGoogleParam(effective.headingFont);

  function update<K extends keyof CampaignTheme>(key: K, v: CampaignTheme[K]) {
    onChange({ ...value, [key]: v });
  }

  // Cross-field swatches: this layer's colors + the inherited brand's colors.
  const swatches = [
    value.accentColor, value.bgColor, value.surfaceColor, value.textColor, value.borderColor,
    inherited?.accentColor, inherited?.bgColor, inherited?.surfaceColor, inherited?.textColor, inherited?.borderColor,
  ];

  return (
    <div>
      {(bodyFontParam || headingFontParam) && (
        <style>{`@import url('https://fonts.googleapis.com/css2?${[
          bodyFontParam ? `family=${bodyFontParam}` : "",
          headingFontParam ? `family=${headingFontParam}` : "",
        ].filter(Boolean).join("&")}&display=swap');`}</style>
      )}

      <MiniPreview theme={effective} />

      <SectionHeader label="Colors" />
      <ColorField label="Brand / Accent" hint="Buttons, CTAs, highlights" value={value.accentColor} inherited={inherited?.accentColor ?? null} swatches={swatches} onChange={(v) => update("accentColor", v)} />
      <ColorField label="Page Background" hint="Canvas behind content" value={value.bgColor} inherited={inherited?.bgColor ?? null} swatches={swatches} onChange={(v) => update("bgColor", v)} />
      <ColorField label="Surface / Card" hint="Cards, panels" value={value.surfaceColor} inherited={inherited?.surfaceColor ?? null} swatches={swatches} onChange={(v) => update("surfaceColor", v)} />
      <ColorField label="Text Color" hint="Headings and body" value={value.textColor} inherited={inherited?.textColor ?? null} swatches={swatches} onChange={(v) => update("textColor", v)} />
      <ColorField label="Border / Divider" hint="Edges, rule lines" value={value.borderColor} inherited={inherited?.borderColor ?? null} swatches={swatches} onChange={(v) => update("borderColor", v)} />

      <div style={{ marginTop: 24 }} />
      <SectionHeader label="Typography" />
      <FontSelect label="Heading / Display Font" hint="Titles and large text" value={value.headingFont} inherited={inherited?.headingFont ?? null} options={HEADING_FONT_OPTIONS} onChange={(v) => update("headingFont", v)} />
      <FontSelect label="Body Font" hint="Paragraphs and UI text" value={value.fontFamily} inherited={inherited?.fontFamily ?? null} options={FONT_OPTIONS} onChange={(v) => update("fontFamily", v)} />

      <div style={{ marginTop: 24 }} />
      <SectionHeader label="Shape & spacing" />
      <RadiusField value={value.radiusStyle} inherited={inherited?.radiusStyle ?? null} onChange={(v) => update("radiusStyle", v)} />
      <DensityField value={value.density} inherited={inherited?.density ?? null} onChange={(v) => update("density", v)} />

      <div style={{ marginTop: 24 }} />
      <SectionHeader label="Logo" />
      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel}>Logo URL</label>
        <input
          type="url"
          value={value.logoUrl ?? ""}
          onChange={(e) => update("logoUrl", e.target.value || null)}
          placeholder={inherited?.logoUrl ? `Inherited: ${inherited.logoUrl}` : "https://your-brand.com/logo.png"}
          style={textInput}
        />
        <span style={hintText}>Shown by the page shell and Campaign Nav.</span>
      </div>
    </div>
  );
}

// ─── Field primitives ──────────────────────────────────────────────────────────

function ColorField({
  label, hint, value, inherited, swatches, onChange,
}: {
  label: string; hint?: string; value: string | null; inherited?: string | null;
  swatches: (string | null | undefined)[]; onChange: (v: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => { setText(value ?? ""); }, [value]);

  const seen = new Set<string>();
  const validSwatches = swatches.filter((s): s is string => {
    if (!s || s === value || seen.has(s)) return false;
    seen.add(s); return true;
  });

  function commit(v: string) {
    const t = v.trim();
    if (!t) { onChange(null); return; }
    if ((t.startsWith("#") && (t.length === 4 || t.length === 7)) || t.startsWith("rgb") || t.startsWith("hsl")) onChange(t);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fieldHeader}>
        <label style={fieldLabel}>{label}</label>
        {hint && <span style={hintText}>{hint}</span>}
      </div>
      {validSwatches.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
          {validSwatches.map((s, i) => (
            <button key={i} type="button" title={`Use ${s}`} onClick={() => onChange(s)}
              style={{ width: 18, height: 18, borderRadius: 3, background: s, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", padding: 0, flexShrink: 0 }} />
          ))}
          <span style={{ ...hintText, lineHeight: "18px", marginLeft: 2 }}>brand colors</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="color"
          value={value && value.startsWith("#") && (value.length === 4 || value.length === 7) ? value : (inherited && inherited.startsWith("#") ? inherited : "#000000")}
          onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
          style={{ width: 32, height: 32, padding: 2, border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer", display: "block", flexShrink: 0 }}
        />
        <input
          type="text"
          value={text}
          placeholder={inherited ? `Inherited: ${inherited}` : "Unset"}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
          style={{ ...textInput, fontFamily: "ui-monospace, monospace", padding: "5px 8px" }}
        />
        {value != null && (
          <button type="button" onClick={() => { onChange(null); setText(""); }} title="Reset to inherited"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex", alignItems: "center", flexShrink: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function FontSelect({
  label, hint, value, inherited, options, onChange,
}: {
  label: string; hint?: string; value: string | null; inherited?: string | null;
  options: readonly { key: string; label: string; family: string; googleFont: string | null }[];
  onChange: (v: string | null) => void;
}) {
  const resolvedKey = value ?? inherited ?? null;
  const resolved = resolvedKey ? options.find((o) => o.key === resolvedKey)?.family : null;
  const inheritLabel = inherited ? options.find((o) => o.key === inherited)?.label : null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fieldHeader}>
        <label style={fieldLabel}>{label}</label>
        {hint && <span style={hintText}>{hint}</span>}
      </div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        style={{ ...textInput, cursor: "pointer", padding: "6px 8px" }}>
        <option value="">{inheritLabel ? `Inherited (${inheritLabel})` : "Unset"}</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      {resolved && (
        <div style={{ marginTop: 6, padding: "6px 10px", background: "var(--bg-overlay)", borderRadius: 6, border: "1px solid var(--border)", fontFamily: resolved, fontSize: 18, color: "var(--text-secondary)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          The quick brown fox
        </div>
      )}
    </div>
  );
}

function RadiusField({
  value, inherited, onChange,
}: {
  value: CampaignTheme["radiusStyle"]; inherited: CampaignTheme["radiusStyle"];
  onChange: (v: CampaignTheme["radiusStyle"]) => void;
}) {
  const effective = value ?? inherited ?? "default";
  const radii = { sharp: 0, default: 8, rounded: 16 };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...fieldLabel, marginBottom: 8 }}>Corner style {value == null && inherited ? <span style={hintText}>(inherited)</span> : null}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {(["sharp", "default", "rounded"] as const).map((v) => {
          const isActive = effective === v;
          return (
            <button key={v} type="button" onClick={() => onChange(v)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", background: isActive ? "var(--accent-muted)" : "var(--bg-raised)", border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, cursor: "pointer" }}>
              <div style={{ width: 24, height: 16, background: isActive ? "var(--accent)" : "var(--bg-overlay)", borderRadius: radii[v], border: `1px solid ${isActive ? "transparent" : "var(--border)"}` }} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? "var(--accent)" : "var(--text-muted)", textTransform: "capitalize" }}>{v}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DensityField({
  value, inherited, onChange,
}: {
  value: CampaignTheme["density"]; inherited: CampaignTheme["density"];
  onChange: (v: CampaignTheme["density"]) => void;
}) {
  const effective = value ?? inherited ?? "comfortable";
  const bars = { compact: 3, comfortable: 6, spacious: 10 };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...fieldLabel, marginBottom: 8 }}>Spacing density {value == null && inherited ? <span style={hintText}>(inherited)</span> : null}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {(["compact", "comfortable", "spacious"] as const).map((v) => {
          const isActive = effective === v;
          return (
            <button key={v} type="button" onClick={() => onChange(v)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", background: isActive ? "var(--accent-muted)" : "var(--bg-raised)", border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, cursor: "pointer" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: bars[v], height: 18, justifyContent: "center" }}>
                <div style={{ width: 20, height: 2, background: isActive ? "var(--accent)" : "var(--text-muted)", borderRadius: 1 }} />
                <div style={{ width: 20, height: 2, background: isActive ? "var(--accent)" : "var(--text-muted)", borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? "var(--accent)" : "var(--text-muted)", textTransform: "capitalize" }}>{v}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14, marginTop: 4, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
      {label}
    </div>
  );
}

export function MiniPreview({ theme }: { theme: CampaignTheme }) {
  const bg = theme.bgColor || "#0f172a";
  const surface = theme.surfaceColor || "rgba(255,255,255,0.05)";
  const text = theme.textColor || "#ffffff";
  const accent = theme.accentColor || "#6366f1";
  const border = theme.borderColor || "rgba(255,255,255,0.1)";
  const headingFamily = resolveHeadingFontFamily(theme.headingFont) ?? "serif";
  const bodyFamily = resolveFontFamily(theme.fontFamily) ?? "system-ui, sans-serif";
  const radii = ({ sharp: 2, default: 8, rounded: 16 } as const)[theme.radiusStyle ?? "default"] ?? 8;
  return (
    <div style={{ background: bg, borderRadius: 8, padding: 14, marginBottom: 20, border: `1px solid ${border}`, overflow: "hidden" }}>
      <div style={{ fontFamily: headingFamily, color: text, fontSize: 20, fontWeight: 700, marginBottom: 4, lineHeight: 1.1 }}>Campaign Preview</div>
      <div style={{ fontFamily: bodyFamily, color: text, fontSize: 11, opacity: 0.55, marginBottom: 12 }}>Body text · supporting copy</div>
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: radii, padding: "8px 10px", marginBottom: 10 }}>
        <div style={{ fontFamily: bodyFamily, color: text, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Card title</div>
        <div style={{ fontFamily: bodyFamily, color: text, fontSize: 10, opacity: 0.5 }}>Supporting text here.</div>
      </div>
      <button style={{ background: accent, color: "#fff", border: "none", borderRadius: radii, padding: "6px 14px", fontSize: 11, fontWeight: 600, fontFamily: bodyFamily, cursor: "default" }}>Get started</button>
    </div>
  );
}

const fieldHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 };
const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-primary)", userSelect: "none" };
const hintText: React.CSSProperties = { fontSize: 10, color: "var(--text-muted)" };
const textInput: React.CSSProperties = { width: "100%", background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box", outline: "none" };
