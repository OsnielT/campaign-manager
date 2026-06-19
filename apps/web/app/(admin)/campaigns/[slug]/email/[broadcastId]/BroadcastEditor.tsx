"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  colorField, dimensionField, alignField, radiusField, imageField,
} from "@/lib/builder/inspector-fields";
import { CampaignThemeContext } from "@/lib/builder/campaign-theme-context";
import {
  BLOCK_ORDER, BLOCK_LABELS, createBlock, EMAIL_THEME_KEYS,
  type EmailBlock, type EmailBlockType, type EmailDesign,
} from "@/lib/email/design";
import type { RuleGroup, Condition, Operator } from "@/lib/campaign-engine/branch";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("primitive_csrf="))?.split("=")[1] ?? "";
}

interface BroadcastData {
  id: string; name: string; subject: string; preheader: string; status: string;
  scheduledAt: string | null; recipientCount: number; sentCount: number; failedCount: number;
  designJson: EmailDesign; segmentFilter: RuleGroup | null; themeOverride: Partial<CampaignTheme> | null;
}

const THEME_FIELDS: { key: typeof EMAIL_THEME_KEYS[number]; label: string }[] = [
  { key: "bgColor", label: "Background" },
  { key: "surfaceColor", label: "Card / container" },
  { key: "textColor", label: "Text" },
  { key: "accentColor", label: "Buttons / accent" },
  { key: "borderColor", label: "Borders" },
];

type FieldKind = "text" | "textarea" | "richtext" | "color" | "dim" | "radius" | "align" | "select" | "image" | "bool";
interface BlockFieldDef { key: string; label: string; kind: FieldKind; opts?: [string, string][] }

const FIELDS: Record<EmailBlockType, BlockFieldDef[]> = {
  logo: [
    { key: "text", label: "Brand text", kind: "text" },
    { key: "imageUrl", label: "Logo image", kind: "image" },
    { key: "height", label: "Height", kind: "dim" },
    { key: "align", label: "Align", kind: "align" },
    { key: "color", label: "Color", kind: "color" },
  ],
  image: [
    { key: "src", label: "Image", kind: "image" },
    { key: "alt", label: "Alt text", kind: "text" },
    { key: "width", label: "Width", kind: "dim" },
    { key: "borderRadius", label: "Corner radius", kind: "radius" },
    { key: "align", label: "Align", kind: "align" },
    { key: "href", label: "Link URL", kind: "text" },
  ],
  heading: [
    { key: "text", label: "Text", kind: "textarea" },
    { key: "level", label: "Tag", kind: "select", opts: [["h1", "H1"], ["h2", "H2"]] },
    { key: "fontSize", label: "Font size", kind: "dim" },
    { key: "align", label: "Align", kind: "align" },
    { key: "color", label: "Color", kind: "color" },
  ],
  text: [
    { key: "html", label: "Content", kind: "richtext" },
    { key: "fontSize", label: "Font size", kind: "dim" },
    { key: "align", label: "Align", kind: "align" },
    { key: "color", label: "Color", kind: "color" },
  ],
  button: [
    { key: "label", label: "Label", kind: "text" },
    { key: "href", label: "Link URL", kind: "text" },
    { key: "bg", label: "Background", kind: "color" },
    { key: "color", label: "Text color", kind: "color" },
    { key: "radius", label: "Corner radius", kind: "radius" },
    { key: "align", label: "Align", kind: "align" },
  ],
  divider: [
    { key: "color", label: "Color", kind: "color" },
    { key: "paddingY", label: "Spacing", kind: "dim" },
  ],
  spacer: [{ key: "height", label: "Height", kind: "dim" }],
  footer: [
    { key: "text", label: "Footer text", kind: "textarea" },
    { key: "color", label: "Color", kind: "color" },
    { key: "showUnsubscribe", label: "Show unsubscribe link", kind: "bool" },
  ],
};

const OPERATORS: [Operator, string][] = [
  ["eq", "is"], ["neq", "is not"], ["contains", "contains"],
  ["gt", ">"], ["lt", "<"], ["is_not_empty", "is set"], ["is_empty", "is empty"],
];

export function BroadcastEditor({
  campaignSlug, campaignName, canEdit, mailConfigured, audienceFields, campaignTheme, broadcast,
}: {
  campaignSlug: string; campaignName: string; canEdit: boolean; mailConfigured: boolean;
  audienceFields: { key: string; label: string }[];
  campaignTheme: CampaignTheme;
  broadcast: BroadcastData;
}) {
  const api = `/api/campaigns/${campaignSlug}/broadcasts/${broadcast.id}`;
  const [name, setName] = useState(broadcast.name);
  const [subject, setSubject] = useState(broadcast.subject);
  const [preheader, setPreheader] = useState(broadcast.preheader);
  const [design, setDesign] = useState<EmailDesign>(broadcast.designJson?.blocks ? broadcast.designJson : { blocks: [] });
  const [segment, setSegment] = useState<RuleGroup | null>(broadcast.segmentFilter);
  const [themeOverride, setThemeOverride] = useState<Partial<CampaignTheme>>(broadcast.themeOverride ?? {});
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState(broadcast.status);
  const [count, setCount] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave
  const save = useCallback(async (patch: Record<string, unknown>) => {
    setSaveState("saving");
    await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() }, body: JSON.stringify(patch) });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1500);
  }, [api]);

  const queueSave = useCallback((patch: Record<string, unknown>) => {
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(patch), 700);
  }, [canEdit, save]);

  // Live preview (debounced)
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${api}/preview`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() }, body: JSON.stringify({ designJson: design, preheader, themeOverride }) });
        setPreviewHtml(await res.text());
      } catch { /* ignore */ }
    }, 350);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [api, design, preheader, themeOverride]);

  // Recipient count (debounced) when segment changes
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${api}/count`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() }, body: JSON.stringify({ segmentFilter: segment }) });
        const d = await res.json();
        setCount(typeof d.count === "number" ? d.count : null);
      } catch { setCount(null); }
    }, 300);
    return () => clearTimeout(t);
  }, [api, segment]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  // ── Block ops ──
  const updateBlocks = (blocks: EmailBlock[]) => { const next = { blocks }; setDesign(next); queueSave({ designJson: next }); };
  const addBlock = (type: EmailBlockType) => { const b = createBlock(type); const blocks = [...design.blocks, b]; updateBlocks(blocks); setSelected(blocks.length - 1); };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= design.blocks.length) return; const blocks = [...design.blocks]; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; updateBlocks(blocks); setSelected(j); };
  const remove = (i: number) => { const blocks = design.blocks.filter((_, k) => k !== i); updateBlocks(blocks); setSelected(null); };
  const setProp = (i: number, key: string, value: unknown) => {
    const blocks = design.blocks.map((b, k) => (k === i ? { ...b, props: { ...b.props, [key]: value } } : b));
    updateBlocks(blocks);
  };

  // ── Theme override ──
  const setTheme = (key: string, value: string) => {
    const next: Partial<CampaignTheme> = { ...themeOverride };
    if (value) (next as Record<string, unknown>)[key] = value;
    else delete (next as Record<string, unknown>)[key];
    setThemeOverride(next);
    queueSave({ themeOverride: Object.keys(next).length ? next : null });
  };
  const resetTheme = () => { setThemeOverride({}); queueSave({ themeOverride: null }); };
  const hasOverride = Object.keys(themeOverride).length > 0;

  // ── Send actions ──
  const testSend = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${api}/test`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() }, body: JSON.stringify({ designJson: design, preheader, subject, themeOverride }) });
      const d = await res.json();
      showToast(!res.ok ? (d.error?.message ?? "Test failed")
        : d.configured ? `Test sent to ${d.to}`
        : `Logged to server console (email not configured — set RESEND_API_KEY to send for real)`);
    } finally { setBusy(false); }
  };
  const sendNow = async () => {
    if (!confirm(`Send this broadcast to ${count ?? "all"} recipient${count === 1 ? "" : "s"} now?`)) return;
    setBusy(true);
    try {
      await save({ name, subject, preheader, designJson: design, segmentFilter: segment, themeOverride });
      const res = await fetch(`${api}/send`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() }, body: JSON.stringify({}) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error?.message ?? "Send failed"); return; }
      const s = d.summary ?? {};
      if (s.configured === false) {
        showToast(`Logged ${s.logged ?? 0} to the server console — email isn't configured. Set RESEND_API_KEY to send for real.`);
      } else {
        setStatus("sent");
        showToast(`Sent ${s.sent ?? 0}${s.failed ? ` · ${s.failed} failed` : ""}`);
      }
    } finally { setBusy(false); }
  };
  const schedule = async () => {
    if (!scheduleAt) { showToast("Pick a date & time"); return; }
    setBusy(true);
    try {
      await save({ name, subject, preheader, designJson: design, segmentFilter: segment, themeOverride });
      const res = await fetch(`${api}/send`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() }, body: JSON.stringify({ scheduledAt: new Date(scheduleAt).toISOString() }) });
      const d = await res.json();
      if (res.ok) { setStatus("scheduled"); showToast(`Scheduled for ${new Date(scheduleAt).toLocaleString()}`); }
      else showToast(d.error?.message ?? "Schedule failed");
    } finally { setBusy(false); }
  };

  const sel = selected != null ? design.blocks[selected] : null;
  const sent = status === "sent" || status === "sending";

  return (
    <div style={shell}>
      {/* Top bar */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link href={`/campaigns/${campaignSlug}/email`} style={backLink}>← Broadcasts</Link>
          <input value={name} disabled={!canEdit} onChange={(e) => { setName(e.target.value); queueSave({ name: e.target.value }); }} style={nameInput} />
          <span style={{ ...statusBadge, color: status === "sent" ? "var(--success)" : status === "scheduled" ? "var(--warning)" : "var(--text-muted)" }}>{status}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
          {canEdit && <button onClick={testSend} disabled={busy} style={ghostBtn}>Send test</button>}
        </div>
      </div>

      <div style={body}>
        {/* Left: blocks */}
        <div style={leftPanel}>
          <div style={panelLabel}>Add block</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
            {BLOCK_ORDER.map((t) => (
              <button key={t} onClick={() => addBlock(t)} disabled={!canEdit} style={addBtn}>+ {BLOCK_LABELS[t]}</button>
            ))}
          </div>
          <div style={panelLabel}>Layout</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {design.blocks.map((b, i) => (
              <div key={b.id} onClick={() => setSelected(i)} style={{ ...blockRow, ...(selected === i ? blockRowActive : {}) }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{BLOCK_LABELS[b.type]}</span>
                {canEdit && (
                  <span style={{ display: "flex", gap: 2 }}>
                    <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} style={miniBtn} title="Up">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} style={miniBtn} title="Down">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); remove(i); }} style={miniBtn} title="Delete">✕</button>
                  </span>
                )}
              </div>
            ))}
            {design.blocks.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No blocks yet.</p>}
          </div>
        </div>

        {/* Center: preview */}
        <div style={center}>
          <iframe title="preview" srcDoc={previewHtml} style={{ width: "100%", height: "100%", border: "none", borderRadius: 8, background: "#fff" }} />
        </div>

        {/* Right: inspector or settings */}
        <div style={rightPanel}>
          {sel ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{BLOCK_LABELS[sel.type]}</span>
                <button onClick={() => setSelected(null)} style={ghostBtn}>Settings</button>
              </div>
              {FIELDS[sel.type].map((f) => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <BlockControl def={f} value={sel.props[f.key]} disabled={!canEdit} onChange={(v) => setProp(selected!, f.key, v)} />
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={panelLabel}>Email</div>
              <Labeled label="Subject"><input value={subject} disabled={!canEdit} onChange={(e) => { setSubject(e.target.value); queueSave({ subject: e.target.value }); }} placeholder="Subject line — use {{name}}" style={input} /></Labeled>
              <Labeled label="Preheader"><input value={preheader} disabled={!canEdit} onChange={(e) => { setPreheader(e.target.value); queueSave({ preheader: e.target.value }); }} placeholder="Preview text shown in inbox" style={input} /></Labeled>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
                <span style={panelLabel}>Theme {hasOverride && <span style={{ color: "var(--accent)", fontWeight: 700 }}>· custom</span>}</span>
                {canEdit && <button onClick={resetTheme} disabled={!hasOverride} style={{ ...ghostBtn, fontSize: 11, padding: "4px 9px", opacity: hasOverride ? 1 : 0.5 }}>Reset to default</button>}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>Empty = inherit the campaign brand.</p>
              <CampaignThemeContext.Provider value={campaignTheme}>
                {THEME_FIELDS.map((f) => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    {colorField(f.label, { inheritColor: (campaignTheme as unknown as Record<string, unknown>)[f.key] as string | undefined }).render({ value: (themeOverride as Record<string, unknown>)[f.key] ?? "", onChange: (v) => setTheme(f.key, v as string) })}
                  </div>
                ))}
              </CampaignThemeContext.Provider>

              <div style={{ ...panelLabel, marginTop: 18 }}>Audience</div>
              <SegmentBuilder fields={audienceFields} value={segment} disabled={!canEdit} onChange={(g) => { setSegment(g); queueSave({ segmentFilter: g }); }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                <strong style={{ color: "var(--text-primary)" }}>{count ?? "…"}</strong> recipient{count === 1 ? "" : "s"} match.
              </p>

              {canEdit && !sent && (
                <>
                  <div style={{ ...panelLabel, marginTop: 18 }}>Send</div>
                  {!mailConfigured && (
                    <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                      Email isn’t configured — sends are only logged to the server console. Set <code>RESEND_API_KEY</code> and a verified <code>EMAIL_FROM</code> to send for real.
                    </div>
                  )}
                  <button onClick={sendNow} disabled={busy || !count} style={{ ...primaryBtn, width: "100%", marginBottom: 10 }}>Send now ({count ?? 0})</button>
                  <Labeled label="Or schedule">
                    <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} style={input} />
                  </Labeled>
                  <button onClick={schedule} disabled={busy} style={{ ...ghostBtn, width: "100%", marginTop: 8 }}>Schedule</button>
                </>
              )}
              {sent && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 18 }}>
                  This broadcast was {status === "sending" ? "sent" : status}. {broadcast.sentCount} sent{broadcast.failedCount ? `, ${broadcast.failedCount} failed` : ""}.
                </p>
              )}
              {status === "scheduled" && broadcast.scheduledAt && (
                <p style={{ fontSize: 13, color: "var(--warning)", marginTop: 10 }}>Scheduled for {new Date(broadcast.scheduledAt).toLocaleString()}.</p>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

// ── Block control renderer ──
function BlockControl({ def, value, disabled, onChange }: { def: BlockFieldDef; value: unknown; disabled: boolean; onChange: (v: unknown) => void }) {
  const render = (field: { render: (p: { value: unknown; onChange: (v: unknown) => void }) => React.ReactNode }) => field.render({ value, onChange });
  switch (def.kind) {
    case "color": return <>{render(colorField(def.label))}</>;
    case "dim": return <>{render(dimensionField(def.label))}</>;
    case "radius": return <>{render(radiusField(def.label))}</>;
    case "align": return <>{render(alignField(def.label))}</>;
    case "image": return <>{render(imageField(def.label))}</>;
    case "bool":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {def.label}
        </label>
      );
    case "select":
      return (
        <Labeled label={def.label}>
          <select value={String(value ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={input}>
            {def.opts?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Labeled>
      );
    case "textarea":
      return <Labeled label={def.label}><textarea value={String(value ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} /></Labeled>;
    case "richtext":
      return <Labeled label={def.label}><RichText value={String(value ?? "")} disabled={disabled} onChange={onChange} /></Labeled>;
    default:
      return <Labeled label={def.label}><input value={String(value ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={input} /></Labeled>;
  }
}

function RichText({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "<p></p>"; }, [value]);
  const cmd = (c: string) => { document.execCommand(c); if (ref.current) onChange(ref.current.innerHTML); };
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 2, padding: 4, borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }} style={miniBtn}><b>B</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("italic"); }} style={miniBtn}><i>I</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("insertUnorderedList"); }} style={miniBtn}>•</button>
      </div>
      <div ref={ref} contentEditable={!disabled} suppressContentEditableWarning onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        style={{ minHeight: 90, padding: 10, fontSize: 13, lineHeight: 1.5, outline: "none", color: "var(--text-primary)" }} />
    </div>
  );
}

function SegmentBuilder({ fields, value, disabled, onChange }: { fields: { key: string; label: string }[]; value: RuleGroup | null; disabled: boolean; onChange: (g: RuleGroup | null) => void }) {
  const conds = (value?.conditions ?? []) as Condition[];
  const logic = value?.logic ?? "and";
  const update = (next: Condition[]) => onChange(next.length ? { logic, conditions: next } : null);
  const add = () => update([...conds, { source: "record", field: fields[0]?.key ?? "", operator: "eq", value: "" }]);
  const setCond = (i: number, patch: Partial<Condition>) => update(conds.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const del = (i: number) => update(conds.filter((_, k) => k !== i));
  const noValue = (op: Operator) => op === "is_empty" || op === "is_not_empty";

  return (
    <div>
      {conds.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>No filter — sends to everyone with an email.</p>}
      {conds.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "center" }}>
          {i > 0 && <button disabled={disabled} onClick={() => onChange({ logic: logic === "and" ? "or" : "and", conditions: conds })} style={{ ...miniBtn, width: 34 }}>{logic}</button>}
          <select disabled={disabled} value={c.field} onChange={(e) => setCond(i, { field: e.target.value })} style={{ ...input, flex: 1, padding: "5px 6px" }}>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            {!fields.some((f) => f.key === c.field) && <option value={c.field}>{c.field}</option>}
          </select>
          <select disabled={disabled} value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value as Operator })} style={{ ...input, width: 90, padding: "5px 6px" }}>
            {OPERATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {!noValue(c.operator) && <input disabled={disabled} value={String(c.value ?? "")} onChange={(e) => setCond(i, { value: e.target.value })} style={{ ...input, width: 90, padding: "5px 6px" }} />}
          <button disabled={disabled} onClick={() => del(i)} style={miniBtn}>✕</button>
        </div>
      ))}
      {!disabled && <button onClick={add} style={{ ...ghostBtn, fontSize: 12, padding: "5px 10px" }}>+ Add filter</button>}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

// ── styles ──
const shell: React.CSSProperties = { display: "flex", flexDirection: "column", height: "calc(100vh - 0px)", background: "var(--bg)" };
const topBar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", height: 52, padding: "0 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 };
const backLink: React.CSSProperties = { fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", whiteSpace: "nowrap" };
const nameInput: React.CSSProperties = { fontSize: 14, fontWeight: 600, border: "1px solid transparent", borderRadius: 6, padding: "5px 8px", background: "transparent", color: "var(--text-primary)", minWidth: 160 };
const statusBadge: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };
const body: React.CSSProperties = { display: "grid", gridTemplateColumns: "240px 1fr 320px", flex: 1, overflow: "hidden" };
const leftPanel: React.CSSProperties = { borderRight: "1px solid var(--border)", padding: 14, overflowY: "auto", background: "var(--bg-surface)" };
const center: React.CSSProperties = { padding: 20, overflowY: "auto", background: "var(--bg-sunken)" };
const rightPanel: React.CSSProperties = { borderLeft: "1px solid var(--border)", padding: 16, overflowY: "auto", background: "var(--bg-surface)" };
const panelLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 };
const addBtn: React.CSSProperties = { fontSize: 12, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg-raised)", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 };
const blockRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--bg-surface)" };
const blockRowActive: React.CSSProperties = { borderColor: "var(--accent)", background: "var(--accent-muted)" };
const miniBtn: React.CSSProperties = { width: 22, height: 22, fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer", padding: 0, lineHeight: 1 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "7px 9px", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { background: "var(--accent)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--bg-overlay)", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, zIndex: 50 };
