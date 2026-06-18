"use client";

// ─── Modern, light-themed Inspector controls for the Puck editor ──────────────
// Industry-standard compact controls (color+gradient, linked spacing, alignment
// toggle, border radius) plus a convention-based `autoField` mapper that picks
// the right control from a prop's name. Styled entirely with the admin CSS
// tokens (--bg-surface / --border / --accent / --text-*), so they match the
// Material-3 reskin and adapt automatically.
//
// IMPORTANT: this module must NOT import from puck-config.tsx — puck-config and
// campaign-blocks both import from here, so the dependency only flows one way.

import React, { useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-css";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Unlink,
  Pipette,
  Code2,
  ChevronDown,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useCampaignTheme } from "@/lib/builder/campaign-theme-context";

// ─── Shared style tokens ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface, #ffffff)",
  border: "1px solid var(--border, #c7c4d8)",
  borderRadius: "var(--radius-sm, 4px)",
  padding: "5px 8px",
  color: "var(--text-primary, #131b2e)",
  fontSize: 12,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary, #464555)",
  letterSpacing: "0.01em",
};

const segWrapStyle: React.CSSProperties = {
  display: "flex",
  background: "var(--bg-raised, #f2f3ff)",
  border: "1px solid var(--border, #c7c4d8)",
  borderRadius: "var(--radius-sm, 4px)",
  padding: 2,
  gap: 2,
};

function segBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 26,
    border: "none",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    background: active ? "var(--accent, #3525cd)" : "transparent",
    color: active ? "var(--text-inverse, #fff)" : "var(--text-secondary, #464555)",
    transition: "background 0.12s, color 0.12s",
  };
}

const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "headlineFontSize" → "Headline font size" */
export function humanize(key: string): string {
  const s = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function parseCustomCss(raw: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const decl of (raw || "").split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim();
    const val = decl.slice(colon + 1).trim();
    if (!prop || !val) continue;
    const camel = prop.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    result[camel] = val;
  }
  return result as React.CSSProperties;
}

// ─── Recent colors (persisted) ────────────────────────────────────────────────

const RECENT_KEY = "puck-recent-colors";
function getRecentColors(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function pushRecentColor(c: string) {
  if (!c || !c.startsWith("#")) return;
  try {
    const next = [c, ...getRecentColors().filter((x) => x !== c)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// ─── Color + gradient field ───────────────────────────────────────────────────

interface GradientStop { color: string; pos: number }

function parseGradient(str: string): { angle: string; stops: GradientStop[] } | null {
  const m = /linear-gradient\(\s*([^,]+),\s*(.+)\)\s*$/i.exec((str || "").trim());
  if (!m) return null;
  const angle = m[1].trim();
  const raw = m[2].split(/,(?![^(]*\))/);
  const stops: GradientStop[] = raw.map((s, i) => {
    const parts = s.trim().split(/\s+/);
    const pos = parts[1] ? parseFloat(parts[1]) : (i / Math.max(1, raw.length - 1)) * 100;
    return { color: parts[0] || "#000000", pos: isNaN(pos) ? 0 : pos };
  });
  return { angle, stops };
}

function buildGradient(angle: string, stops: GradientStop[]): string {
  const body = stops.map((s) => `${s.color} ${Math.round(s.pos)}%`).join(", ");
  return `linear-gradient(${angle}, ${body})`;
}

const SwatchBtn = ({ color, active, title, onClick }: { color: string; active: boolean; title: string; onClick: () => void }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      width: 18,
      height: 18,
      borderRadius: 4,
      background: color,
      border: active ? "2px solid var(--accent, #3525cd)" : "1px solid var(--border, #c7c4d8)",
      cursor: "pointer",
      padding: 0,
      flexShrink: 0,
    }}
  />
);

function ColorField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  const theme = useCampaignTheme();
  const current = (value as string) || "";
  const isGradient = /gradient\(/i.test(current);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"solid" | "gradient">(isGradient ? "gradient" : "solid");
  const [recent, setRecent] = useState<string[]>([]);
  const [grad, setGrad] = useState(() => parseGradient(current) ?? { angle: "135deg", stops: [{ color: "#3525cd", pos: 0 }, { color: "#4f46e5", pos: 100 }] });

  useEffect(() => { if (open) setRecent(getRecentColors()); }, [open]);

  const themeSwatches = [
    { color: theme?.accentColor, name: "Accent" },
    { color: theme?.bgColor, name: "Background" },
    { color: theme?.surfaceColor, name: "Surface" },
    { color: theme?.textColor, name: "Text" },
    { color: theme?.borderColor, name: "Border" },
  ].filter((s): s is { color: string; name: string } => Boolean(s.color));

  const commit = (v: string) => { pushRecentColor(v); onChange(v); };
  const commitGrad = (next: { angle: string; stops: GradientStop[] }) => { setGrad(next); onChange(buildGradient(next.angle, next.stops)); };

  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;
  const pickEyeDropper = async () => {
    try {
      const ed = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
      const res = await ed.open();
      commit(res.sRGBHex);
    } catch { /* cancelled */ }
  };

  const preview = current || "transparent";

  return (
    <div style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      {/* Trigger row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Edit color"
          style={{
            width: 26, height: 26, borderRadius: "var(--radius-sm,4px)", flexShrink: 0, cursor: "pointer",
            border: "1px solid var(--border, #c7c4d8)", padding: 0,
            background: current
              ? `${preview}`
              : "repeating-conic-gradient(#e2e7ff 0% 25%, #fff 0% 50%) 50% / 10px 10px",
          }}
        />
        <input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="inherit from theme"
          style={{ ...inputStyle, flex: 1 }}
        />
        {current && (
          <button type="button" onClick={() => onChange("")} title="Clear (inherit)" style={iconBtn}>
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div style={popoverStyle}>
          {/* Tabs */}
          <div style={{ ...segWrapStyle, marginBottom: 8 }}>
            <button type="button" style={segBtnStyle(tab === "solid")} onClick={() => setTab("solid")}>Solid</button>
            <button type="button" style={segBtnStyle(tab === "gradient")} onClick={() => setTab("gradient")}>Gradient</button>
          </div>

          {tab === "solid" ? (
            <div style={fieldWrap}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#000000"}
                  onChange={(e) => commit(e.target.value)}
                  style={{ width: 30, height: 28, padding: 2, border: "1px solid var(--border,#c7c4d8)", borderRadius: 4, background: "none", cursor: "pointer", flexShrink: 0 }}
                />
                <input type="text" value={current} onChange={(e) => onChange(e.target.value)} placeholder="#000000" style={{ ...inputStyle, flex: 1 }} />
                {hasEyeDropper && (
                  <button type="button" onClick={pickEyeDropper} title="Eyedropper" style={iconBtn}><Pipette size={14} /></button>
                )}
              </div>
              {themeSwatches.length > 0 && (
                <div>
                  <span style={miniLabel}>Theme</span>
                  <div style={swatchRow}>
                    {themeSwatches.map((s) => <SwatchBtn key={s.name} color={s.color} active={current === s.color} title={`${s.name}: ${s.color}`} onClick={() => commit(s.color)} />)}
                  </div>
                </div>
              )}
              {recent.length > 0 && (
                <div>
                  <span style={miniLabel}>Recent</span>
                  <div style={swatchRow}>
                    {recent.map((c) => <SwatchBtn key={c} color={c} active={current === c} title={c} onClick={() => commit(c)} />)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={fieldWrap}>
              <div style={{ height: 28, borderRadius: 4, border: "1px solid var(--border,#c7c4d8)", background: buildGradient(grad.angle, grad.stops) }} />
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={miniLabel}>Angle</span>
                <input
                  type="range" min={0} max={360}
                  value={parseInt(grad.angle, 10) || 0}
                  onChange={(e) => commitGrad({ ...grad, angle: `${e.target.value}deg` })}
                  style={{ flex: 1, accentColor: "var(--accent,#3525cd)" }}
                />
                <span style={{ ...miniLabel, width: 34, textAlign: "right" }}>{parseInt(grad.angle, 10) || 0}°</span>
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {grad.stops.map((stop, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="color" value={/^#[0-9a-f]{6}$/i.test(stop.color) ? stop.color : "#000000"}
                      onChange={(e) => { const stops = [...grad.stops]; stops[i] = { ...stops[i], color: e.target.value }; commitGrad({ ...grad, stops }); }}
                      style={{ width: 26, height: 24, padding: 2, border: "1px solid var(--border,#c7c4d8)", borderRadius: 4, background: "none", cursor: "pointer", flexShrink: 0 }}
                    />
                    <input
                      type="number" min={0} max={100} value={Math.round(stop.pos)}
                      onChange={(e) => { const stops = [...grad.stops]; stops[i] = { ...stops[i], pos: Number(e.target.value) }; commitGrad({ ...grad, stops }); }}
                      style={{ ...inputStyle, width: 56 }}
                    />
                    <span style={miniLabel}>%</span>
                    {grad.stops.length > 2 && (
                      <button type="button" style={iconBtn} title="Remove stop"
                        onClick={() => commitGrad({ ...grad, stops: grad.stops.filter((_, j) => j !== i) })}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button" style={textBtn}
                onClick={() => commitGrad({ ...grad, stops: [...grad.stops, { color: "#ffffff", pos: 100 }] })}
              >+ Add stop</button>
            </div>
          )}
          <button type="button" style={{ ...textBtn, marginTop: 8 }} onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, flexShrink: 0, padding: 0, cursor: "pointer",
  background: "var(--bg-raised, #f2f3ff)", border: "1px solid var(--border,#c7c4d8)",
  borderRadius: "var(--radius-sm,4px)", color: "var(--text-secondary,#464555)",
};

const textBtn: React.CSSProperties = {
  alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer",
  color: "var(--accent, #3525cd)", fontSize: 12, fontWeight: 600, padding: "2px 0",
};

const miniLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "var(--text-muted, #777587)", textTransform: "uppercase", letterSpacing: "0.06em" };
const swatchRow: React.CSSProperties = { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 };

const popoverStyle: React.CSSProperties = {
  background: "var(--bg-surface, #fff)",
  border: "1px solid var(--border, #c7c4d8)",
  borderRadius: "var(--radius, 8px)",
  padding: 10,
  boxShadow: "var(--shadow, 0 4px 12px rgba(19,27,46,0.08))",
};

export function colorField(label: string) {
  return {
    type: "custom" as const,
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
      <ColorField label={label} value={value} onChange={onChange} />
    ),
  };
}

// ─── Spacing field (linked top/right/bottom/left) ─────────────────────────────

export interface SpacingValue { top: number; right: number; bottom: number; left: number }
export const SPACING_ZERO: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };

export function spacingToCss(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { top = 0, right = 0, bottom = 0, left = 0 } = v as Partial<SpacingValue>;
  if (!top && !right && !bottom && !left) return undefined;
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

function SpacingField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: SpacingValue) => void }) {
  const v: SpacingValue = value && typeof value === "object" ? { ...SPACING_ZERO, ...(value as Partial<SpacingValue>) } : SPACING_ZERO;
  const [linked, setLinked] = useState(() => v.top === v.right && v.right === v.bottom && v.bottom === v.left);

  const set = (key: keyof SpacingValue, n: number) => {
    if (linked) onChange({ top: n, right: n, bottom: n, left: n });
    else onChange({ ...v, [key]: n });
  };

  const sides: Array<{ key: keyof SpacingValue; label: string }> = [
    { key: "top", label: "T" },
    { key: "right", label: "R" },
    { key: "bottom", label: "B" },
    { key: "left", label: "L" },
  ];

  return (
    <div style={fieldWrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={labelStyle}>{label}</span>
        <button
          type="button" onClick={() => setLinked((l) => !l)}
          title={linked ? "Sides linked — edit all together" : "Sides independent"}
          style={{ ...iconBtn, width: 22, height: 22, color: linked ? "var(--accent,#3525cd)" : "var(--text-muted,#777587)" }}
        >
          {linked ? <Link2 size={12} /> : <Unlink size={12} />}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        {sides.map(({ key, label: l }) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <input
              type="number" value={v[key]}
              onChange={(e) => set(key, Number(e.target.value))}
              style={{ ...inputStyle, padding: "4px 2px", textAlign: "center" }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted,#777587)", letterSpacing: "0.06em" }}>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function spacingField(label: string) {
  return {
    type: "custom" as const,
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: SpacingValue) => void }) => (
      <SpacingField label={label} value={value} onChange={onChange} />
    ),
  };
}

// ─── Alignment toggle group ───────────────────────────────────────────────────

const ALIGN_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
};

function AlignField({ label, value, options, onChange }: { label: string; value: unknown; options: string[]; onChange: (v: string) => void }) {
  const current = (value as string) || "";
  return (
    <div style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <div style={segWrapStyle}>
        {options.map((opt) => {
          const Icon = ALIGN_ICONS[opt];
          const active = current === opt;
          return (
            <button
              key={opt} type="button" title={humanize(opt)}
              style={segBtnStyle(active)}
              onClick={() => onChange(active ? "" : opt)}
            >
              {Icon ? <Icon size={14} /> : humanize(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function alignField(label: string, options: string[] = ["left", "center", "right"]) {
  return {
    type: "custom" as const,
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
      <AlignField label={label} value={value} options={options} onChange={onChange} />
    ),
  };
}

// ─── Border radius ────────────────────────────────────────────────────────────

const RADIUS_PRESETS: Array<{ label: string; value: string }> = [
  { label: "None", value: "0" },
  { label: "SM", value: "4px" },
  { label: "MD", value: "8px" },
  { label: "LG", value: "16px" },
  { label: "Full", value: "9999px" },
];

function RadiusField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  const current = (value as string) || "";
  const numeric = parseInt(current, 10);
  const sliderVal = isNaN(numeric) ? 0 : Math.min(64, numeric);
  return (
    <div style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {RADIUS_PRESETS.map((p) => {
          const active = current === p.value;
          return (
            <button
              key={p.value} type="button"
              onClick={() => onChange(active ? "" : p.value)}
              style={{
                flex: "1 1 0", minWidth: 38, height: 24, fontSize: 11, fontWeight: 600, cursor: "pointer",
                borderRadius: "var(--radius-sm,4px)",
                border: active ? "1px solid var(--accent,#3525cd)" : "1px solid var(--border,#c7c4d8)",
                background: active ? "var(--accent-muted, #3525cd14)" : "var(--bg-surface,#fff)",
                color: active ? "var(--accent,#3525cd)" : "var(--text-secondary,#464555)",
              }}
            >{p.label}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range" min={0} max={64} value={sliderVal}
          onChange={(e) => onChange(`${e.target.value}px`)}
          style={{ flex: 1, accentColor: "var(--accent,#3525cd)" }}
        />
        <input
          type="text" value={current} placeholder="e.g. 12px"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, width: 72 }}
        />
      </div>
    </div>
  );
}

export function radiusField(label: string) {
  return {
    type: "custom" as const,
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
      <RadiusField label={label} value={value} onChange={onChange} />
    ),
  };
}

// ─── Dimension (number + unit) ────────────────────────────────────────────────
// Consistent size control for width / height / font-size / spacing values. The
// raw value stays a CSS string; simple values use the number+unit widget, while
// complex values (clamp/calc/var) drop to an advanced inline CSS input.

const UNITS = ["px", "rem", "em", "%", "vw", "vh", "—", "auto"];

interface DimParts { num: string; unit: string; complex: boolean }
function parseDim(v: string): DimParts {
  const s = (v || "").trim();
  if (!s) return { num: "", unit: "px", complex: false };
  if (s === "auto") return { num: "", unit: "auto", complex: false };
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em|%|vw|vh)?$/i.exec(s);
  if (m) return { num: m[1], unit: (m[2] as string) || "—", complex: false };
  return { num: "", unit: "px", complex: true };
}

function DimensionField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  const raw = (value as string) || "";
  const parsed = parseDim(raw);
  const [advanced, setAdvanced] = useState(parsed.complex);
  useEffect(() => { if (parseDim(((value as string) || "")).complex) setAdvanced(true); }, [value]);

  const emit = (n: string, u: string) => {
    if (u === "auto") return onChange("auto");
    if (n === "") return onChange("");
    if (u === "—") return onChange(n);
    onChange(`${n}${u}`);
  };

  return (
    <div style={fieldWrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={labelStyle}>{label}</span>
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          title={advanced ? "Simple value" : "Advanced CSS value (clamp, calc, var…)"}
          style={{ ...iconBtn, width: 22, height: 22, color: advanced ? "var(--accent,#3525cd)" : "var(--text-muted,#777587)" }}
        >
          <Code2 size={12} />
        </button>
      </div>
      {advanced ? (
        <input
          type="text" value={raw}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. clamp(1rem, 2vw, 2rem)"
          style={inputStyle}
        />
      ) : (
        <div style={{ display: "flex", gap: 5 }}>
          <input
            type="number"
            value={parsed.num}
            disabled={parsed.unit === "auto"}
            placeholder={parsed.unit === "auto" ? "auto" : "—"}
            onChange={(e) => emit(e.target.value, parsed.unit)}
            style={{ ...inputStyle, flex: 1, opacity: parsed.unit === "auto" ? 0.5 : 1 }}
          />
          <select
            value={parsed.unit}
            onChange={(e) => emit(parsed.num, e.target.value)}
            style={{ ...inputStyle, width: 64, cursor: "pointer" }}
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export function dimensionField(label: string) {
  return {
    type: "custom" as const,
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
      <DimensionField label={label} value={value} onChange={onChange} />
    ),
  };
}

// ─── Custom CSS (Prism, light theme) ──────────────────────────────────────────

const PRISM_LIGHT_CSS = `
.puck-css-editor .token.property { color: #3525cd; }
.puck-css-editor .token.selector, .puck-css-editor .token.tag { color: #ba1a1a; }
.puck-css-editor .token.punctuation { color: #777587; }
.puck-css-editor .token.value, .puck-css-editor .token.string { color: #0a7d4f; }
.puck-css-editor .token.number, .puck-css-editor .token.unit { color: #7e5a00; }
.puck-css-editor .token.hexcode, .puck-css-editor .token.color { color: #ba1a1a; }
.puck-css-editor .token.keyword, .puck-css-editor .token.function { color: #4f46e5; }
.puck-css-editor .token.comment { color: #9090a0; font-style: italic; }
`.trim();

function CssSyntaxEditor({ value, onChange }: { value: unknown; onChange: (v: string) => void }) {
  const text = (value as string) || "";
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const id = "puck-prism-css-theme";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = PRISM_LIGHT_CSS;
    document.head.appendChild(el);
  }, []);
  return (
    <div className="puck-css-editor" style={{ borderRadius: "var(--radius-sm,4px)", overflow: "hidden", border: "1px solid var(--border,#c7c4d8)", background: "var(--bg-raised,#f2f3ff)" }}>
      <Editor
        value={text}
        onValueChange={onChange}
        highlight={(code) => Prism.highlight(code, Prism.languages.css, "css")}
        padding={10}
        insertSpaces
        tabSize={2}
        placeholder={"color: red;\nfont-size: 16px;"}
        style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Mono', monospace", fontSize: 12, lineHeight: 1.6, color: "var(--text-primary,#131b2e)", minHeight: 80, caretColor: "var(--accent,#3525cd)" }}
      />
    </div>
  );
}

export const customCssField = {
  type: "custom" as const,
  label: "Custom CSS",
  render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
    <CssSyntaxEditor value={value} onChange={onChange} />
  ),
};

// ─── Section header (collapsible accordion that groups inspector fields) ──────
// A label-less custom field rendering a clickable group heading. It stores no
// value (data shape unchanged); clicking it collapses/expands the sibling field
// rows that follow it (up to the next section header). Puck renders every field
// as a sibling `_PuckFields-field` row, so the header finds its own row and
// toggles the following rows' display.

// Collapse state is keyed by label and shared across components, so a section
// (e.g. "Advanced") stays collapsed as you move between blocks.
const sectionCollapse: Record<string, boolean> = {};

function SectionHeader({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => sectionCollapse[label] ?? false);
  const collapsedRef = useRef(collapsed);

  const apply = (isCollapsed: boolean) => {
    const el = ref.current;
    if (!el) return;
    // Climb to the field-row wrapper (the level whose parent holds many rows).
    let row: HTMLElement | null = el;
    while (row.parentElement && row.parentElement.childElementCount <= 1) row = row.parentElement;
    let sib = row.nextElementSibling as HTMLElement | null;
    while (sib && !sib.querySelector(".puck-section-header")) {
      sib.style.display = isCollapsed ? "none" : "";
      sib = sib.nextElementSibling as HTMLElement | null;
    }
  };

  // Re-apply after every render — Puck recreates the rows on edits, which would
  // otherwise drop the inline display state.
  useEffect(() => { apply(collapsedRef.current); });

  const toggle = () => {
    const next = !collapsedRef.current;
    collapsedRef.current = next;
    sectionCollapse[label] = next;
    setCollapsed(next);
    apply(next);
  };

  return (
    <div
      ref={ref}
      className="puck-section-header"
      onClick={toggle}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--text-muted, #777587)", marginTop: 6, marginBottom: 2,
        paddingBottom: 6, borderBottom: "1px solid var(--border, #c7c4d8)",
        cursor: "pointer", userSelect: "none",
      }}
    >
      <span>{label}</span>
      <ChevronDown
        size={13}
        style={{ transition: "transform 0.15s", transform: collapsed ? "rotate(-90deg)" : "none", flexShrink: 0 }}
      />
    </div>
  );
}

/** A collapsible grouping header to place between fields in a component's `fields` map. */
export function sectionField(label: string) {
  return {
    type: "custom" as const,
    render: () => <SectionHeader label={label} />,
  };
}

/** Return a copy of a fields map without the given keys — for `resolveFields`. */
export function omitFields<T extends Record<string, unknown>>(fields: T, keys: string[]): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (!keys.includes(k)) out[k] = v;
  return out as T;
}

// ─── Image picker (browse uploaded media) ─────────────────────────────────────

interface MediaAsset { id: string; filename: string; publicUrl: string; contentType: string }

function ImagePickerField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  const url = (value as string) || "";
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/media?limit=60");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAssets(((json.assets as MediaAsset[]) ?? []).filter((a) => /^image\//.test(a.contentType)));
    } catch { setErr("Couldn't load media."); }
    finally { setLoading(false); }
  };

  const toggle = () => { setOpen((o) => !o); if (!assets) load(); };

  return (
    <div style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{
          width: 30, height: 30, borderRadius: "var(--radius-sm,4px)", flexShrink: 0,
          border: "1px solid var(--border,#c7c4d8)",
          ...(url
            ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "var(--bg-raised,#f2f3ff)" }),
        }} />
        <input type="text" value={url} onChange={(e) => onChange(e.target.value)} placeholder="Image URL or browse →" style={{ ...inputStyle, flex: 1 }} />
        <button type="button" onClick={toggle} title="Browse media" style={iconBtn}><ImageIcon size={14} /></button>
        {url && <button type="button" onClick={() => onChange("")} title="Clear" style={iconBtn}><X size={13} /></button>}
      </div>
      {open && (
        <div style={popoverStyle}>
          {loading && <span style={miniLabel}>Loading…</span>}
          {err && <span style={{ ...miniLabel, color: "var(--danger,#ba1a1a)" }}>{err}</span>}
          {assets && !loading && assets.length === 0 && (
            <span style={miniLabel}>No images yet — upload in the Media tab.</span>
          )}
          {assets && assets.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {assets.map((a) => (
                <button
                  key={a.id} type="button" title={a.filename}
                  onClick={() => { onChange(a.publicUrl); setOpen(false); }}
                  style={{
                    aspectRatio: "1 / 1", borderRadius: 4, cursor: "pointer", padding: 0,
                    border: url === a.publicUrl ? "2px solid var(--accent,#3525cd)" : "1px solid var(--border,#c7c4d8)",
                    backgroundImage: `url(${a.publicUrl})`, backgroundSize: "cover", backgroundPosition: "center",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function imageField(label: string) {
  return {
    type: "custom" as const,
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: string) => void }) => (
      <ImagePickerField label={label} value={value} onChange={onChange} />
    ),
  };
}

// ─── Convention-based field mapper ────────────────────────────────────────────

type AnyField = Record<string, unknown>;

interface AutoOpts { label?: string; alignOptions?: string[] }

/**
 * Infer a modern control from a prop key. Color-ish names (xColor / bgX /
 * background) get the color+gradient picker, padding/margin get linked spacing,
 * *align gets the toggle group, *radius gets the radius control. Everything else
 * falls back to a sensible text/number input.
 */
export function autoField(key: string, opts: AutoOpts = {}): AnyField {
  const label = opts.label ?? humanize(key);
  if (key === "customCss") return customCssField;
  if (key === "className") return { type: "text", label: "CSS class" };
  if (key === "padding" || key === "margin") return spacingField(label);
  if (/align$/i.test(key)) return alignField(label, opts.alignOptions);
  if (/radius/i.test(key)) return radiusField(label);
  if (/(color|colour)$/i.test(key) || /^bg/i.test(key) || (/background/i.test(key) && !/image|url/i.test(key))) {
    return colorField(label);
  }
  if (key === "opacity") return { type: "number", label, min: 0, max: 1, step: 0.01 };
  if (DIMENSION_KEYS.has(key.toLowerCase())) return dimensionField(label);
  return { type: "text", label };
}

// Size/spacing props that should use the number+unit dimension control.
const DIMENSION_KEYS = new Set([
  "width", "maxwidth", "minwidth", "height", "maxheight", "minheight",
  "fontsize", "lineheight", "letterspacing", "gap",
  "paddingx", "paddingy", "paddingtop", "paddingbottom", "paddingleft", "paddingright",
]);

/** Build a Puck `fields` map from an array of prop keys via `autoField`. */
export function cssFields(keys: string[], overrides: Record<string, AutoOpts> = {}): Record<string, AnyField> {
  const out: Record<string, AnyField> = {};
  for (const k of keys) out[k] = autoField(k, overrides[k]);
  return out;
}
