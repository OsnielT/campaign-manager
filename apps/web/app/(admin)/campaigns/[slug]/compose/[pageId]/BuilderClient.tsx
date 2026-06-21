"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Puck, usePuck, type Data, type Overrides } from "@measured/puck";
import "@measured/puck/puck.css";
import { puckConfig } from "@/lib/builder/puck-config";
import { migrateLegacySlots } from "@/lib/builder/campaign-blocks";
import { extractStyle, applyStyleToTree, type PuckTreeLike, type StyleScope } from "@/lib/builder/style-propagation";
import { buildThemeVars, resolveFontFamily, resolveBrand, getHeadingFontGoogleParam, getFontGoogleParam } from "@/lib/campaign-engine/theme";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";
import { CampaignThemeContext } from "@/lib/builder/campaign-theme-context";
import Link from "next/link";
import { Eye, GripVertical, Loader2, Palette, Wand2 } from "lucide-react";
import type { PageNavItem } from "./page";

type SaveState = "idle" | "saving" | "saved" | "error";
type PreviewState = "idle" | "generating" | "error";

const DEBOUNCE_MS = 800;

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

export function BuilderClient({
  pageId,
  campaignName,
  campaignSlug,
  pageTitle,
  pages,
  initialData,
  canEdit,
  theme,
  orgBranding,
}: {
  pageId: string;
  campaignName: string;
  campaignSlug: string;
  pageTitle: string;
  pages: PageNavItem[];
  initialData: Data;
  canEdit: boolean;
  theme: CampaignTheme | null;
  orgBranding: CampaignTheme | null;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  // The canvas previews the effective brand (org defaults under campaign
  // overrides). Branding is authored in the campaign Branding tab.
  const effectiveTheme = resolveBrand(orgBranding, theme);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const themeVars = buildThemeVars(effectiveTheme);
  const fontFamily = resolveFontFamily(effectiveTheme.fontFamily);

  // Inject Google Fonts for both body and heading fonts
  useEffect(() => {
    const params: string[] = [];
    const bodyParam = getFontGoogleParam(effectiveTheme.fontFamily);
    const headingParam = getHeadingFontGoogleParam(effectiveTheme.headingFont);
    if (bodyParam) params.push(bodyParam);
    if (headingParam) params.push(headingParam);
    if (!params.length) return;
    const id = "builder-google-fonts";
    let el = document.getElementById(id) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.id = id;
      el.rel = "stylesheet";
      document.head.appendChild(el);
    }
    el.href = `https://fonts.googleapis.com/css2?${params.map((p) => `family=${p}`).join("&")}&display=swap`;
  }, [effectiveTheme.fontFamily, effectiveTheme.headingFont]);

  const save = useCallback(
    async (data: Data) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/campaign-pages/${pageId}/composition`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrf(),
          },
          body: JSON.stringify({ treeJson: data }),
        });
        setSaveState(res.ok ? "saved" : "error");
        if (res.ok) setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
      }
    },
    [pageId]
  );

  const handleChange = useCallback(
    (data: Data) => {
      if (!canEdit) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveState("idle");
      debounceRef.current = setTimeout(() => save(data), DEBOUNCE_MS);
    },
    [canEdit, save]
  );

  const handlePreview = useCallback(async () => {
    setPreviewState("generating");
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/preview-token`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      if (!res.ok) throw new Error("Failed to generate preview");
      const { token } = await res.json();
      window.open(`/preview/${token}?pageId=${pageId}`, "_blank", "noopener");
      setPreviewState("idle");
    } catch {
      setPreviewState("error");
      setTimeout(() => setPreviewState("idle"), 3000);
    }
  }, [campaignSlug, pageId]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Append a "match style across pages" control under the Puck fields panel.
  const overrides = useMemo<Partial<Overrides>>(() => ({
    fields: ({ children }) => (
      <>
        {children}
        <PropagateStyleControl campaignSlug={campaignSlug} />
      </>
    ),
    // Render each draggable drawer item with its config icon inside the box,
    // alongside the name. Puck passes the default bordered box as opaque
    // `children`, so we rebuild the row to place the icon within it.
    drawerItem: ({ name }) => {
      const cfg = (puckConfig.components as Record<string, { icon?: React.ReactNode; label?: string }>)[name];
      return (
        <div
          style={{
            background: "var(--puck-color-white)",
            cursor: "grab",
            padding: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px var(--puck-color-grey-09) solid",
            borderRadius: 4,
            fontSize: "var(--puck-font-size-xxs)",
          }}
        >
          {cfg?.icon && (
            <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--puck-color-grey-05)" }}>
              {cfg.icon}
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cfg?.label ?? name}
          </span>
          <GripVertical size={16} style={{ flexShrink: 0, color: "var(--puck-color-grey-05)" }} />
        </div>
      );
    },
  }), [campaignSlug]);

  return (
    <div style={shell}>
      {/* Top bar */}
      <div style={topBar}>
        <div style={topBarLeft}>
          <Link href={`/campaigns/${campaignSlug}`} style={backLink}>
            ← Campaign Manager
          </Link>
          <span style={divider} />
        </div>
        <div style={topBarCenter}>
          {pages.map((pg) => {
            const isActive = pg.id === pageId;
            return (
              <Link
                key={pg.id}
                href={`/campaigns/${campaignSlug}/compose/${pg.id}`}
                style={isActive ? { ...pageChip, ...pageChipActive } : pageChip}
                title={pg.path}
              >
                {pg.isEntry && <span style={{ ...chipDot, background: "var(--accent)" }} />}
                {pg.isConversionPage && <span style={{ ...chipDot, background: "var(--success)" }} />}
                {pg.title}
              </Link>
            );
          })}
        </div>
        <div style={topBarRight}>
          <SaveIndicator state={saveState} />
          <Link
            href={`/campaigns/${campaignSlug}/branding`}
            style={previewBtn}
            title="Edit branding (colors, fonts, shape) — the canvas below previews it live"
          >
            <Palette size={13} />
            Branding
          </Link>
          <button
            onClick={handlePreview}
            disabled={previewState === "generating"}
            style={{
              ...previewBtn,
              ...(previewState === "error" ? previewBtnError : {}),
            }}
            title="Open a shareable preview in a new tab (72h link)"
          >
            {previewState === "generating"
              ? <Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} />
              : <Eye size={13} />}
            {previewState === "error" ? "Failed" : "Preview"}
          </button>
          {!canEdit && (
            <span style={readOnlyBadge}>View only</span>
          )}
        </div>
      </div>

      {/* Puck editor — CSS vars + cascade-friendly color/font on wrapper so child elements can inherit */}
      <div className="puck-editor" style={{
        ...editorWrap,
        ...themeVars,
        ...(fontFamily ? { fontFamily } : {}),
        ...(effectiveTheme.textColor ? { color: effectiveTheme.textColor } : {}),
      }}>
        <CampaignThemeContext.Provider value={effectiveTheme}>
          <Puck
            config={puckConfig}
            data={migrateLegacySlots(initialData as Parameters<typeof migrateLegacySlots>[0]) as Data}
            onChange={handleChange}
            onPublish={save}
            overrides={canEdit ? overrides : undefined}
            permissions={canEdit ? undefined : { drag: false, duplicate: false, delete: false, insert: false, edit: false }}
            viewports={[
              { width: 375, label: "Mobile" },
              { width: 768, label: "Tablet" },
              { width: 1280, label: "Desktop" },
            ]}
          />
        </CampaignThemeContext.Provider>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const configs: Record<SaveState, { label: string; color: string }> = {
    idle: { label: "All changes saved", color: "var(--text-muted)" },
    saving: { label: "Saving…", color: "var(--text-secondary)" },
    saved: { label: "Saved", color: "var(--success)" },
    error: { label: "Save failed", color: "var(--danger)" },
  };
  const { label, color } = configs[state];
  return (
    <span style={{ fontSize: "12px", fontWeight: "500", color, transition: "color 0.2s" }}>
      {state === "saving" && <span style={spinner} />}
      {label}
    </span>
  );
}

// "Match style across pages" — rendered under the Puck fields panel for the
// selected component. Copies its appearance to every same-type component on
// every page of the campaign.
function PropagateStyleControl({ campaignSlug }: { campaignSlug: string }) {
  const { appState, dispatch, selectedItem, getSelectorForId, getItemById } = usePuck();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  // `selectedItem` resolves the selection wherever it lives — top-level content,
  // a DropZone, or a slot — so the control appears for every component.
  const item = selectedItem as { type: string; props: Record<string, unknown> } | null;

  // Reset feedback whenever the selection changes.
  const selKey = item ? (item.props.id as string) ?? "" : "";
  useEffect(() => { setMsg(null); }, [selKey]);

  if (!item) return null;

  const type = item.type;
  const label = (puckConfig.components as Record<string, { label?: string }>)[type]?.label ?? type;

  // Scope generic primitives (Text/Button/…) to their slot context so a Hero
  // headline only matches other Hero headlines — not every text on the page.
  const computeScope = (): StyleScope | null => {
    const id = item.props.id as string | undefined;
    if (!id) return null;
    const sel = getSelectorForId(id);
    const zone = sel?.zone;
    if (!zone) return null;
    const ci = zone.indexOf(":");
    if (ci < 0) return null;
    const parent = getItemById(zone.slice(0, ci));
    if (!parent) return null;
    return { parentType: parent.type, slotKey: zone.slice(ci + 1) };
  };

  const onClick = async () => {
    const style = extractStyle(item.props);
    if (!Object.keys(style).length) {
      setMsg({ text: "This component has no style to copy.", tone: "error" });
      return;
    }
    const scope = computeScope();
    const where = scope
      ? `every matching ${label} in the same spot`
      : `every other ${label}`;
    if (!window.confirm(`Match this ${label}'s style on ${where} across all pages in this campaign? Their content stays unchanged.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/propagate-style`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ type, style, scope }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      // Reflect immediately on the current page (other instances) too.
      const next = JSON.parse(JSON.stringify(appState.data)) as PuckTreeLike;
      applyStyleToTree(next, type, style, scope);
      dispatch({ type: "setData", data: next as Partial<Data> });
      setMsg({
        text: `Matched ${json.components} ${label}${json.components === 1 ? "" : "s"} across ${json.pages} page${json.pages === 1 ? "" : "s"}.`,
        tone: "ok",
      });
    } catch {
      setMsg({ text: "Couldn't apply the style. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={propagateWrap}>
      <button type="button" onClick={onClick} disabled={busy} style={propagateBtn}>
        {busy
          ? <Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} />
          : <Wand2 size={13} />}
        {busy ? "Matching…" : `Match this ${label}'s style across pages`}
      </button>
      {msg && (
        <p style={{ ...propagateMsg, color: msg.tone === "ok" ? "var(--success)" : "var(--danger)" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const propagateWrap: React.CSSProperties = {
  padding: "12px 16px",
  borderTop: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const propagateBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "8px 12px",
  borderRadius: "var(--radius-sm)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-inverse)",
  background: "var(--accent)",
  border: "none",
  cursor: "pointer",
};

const propagateMsg: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.4,
};

const shell: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  overflow: "hidden",
  background: "var(--bg)",
};

const topBar: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  height: "48px",
  padding: "0 16px",
  background: "var(--bg-surface)",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
  zIndex: 10,
};

const topBarLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const topBarCenter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

const topBarRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  justifyContent: "flex-end",
};

const pageChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "4px 10px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "500",
  color: "var(--text-secondary)",
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "background 0.1s, color 0.1s",
};

const pageChipActive: React.CSSProperties = {
  background: "var(--accent-muted)",
  color: "var(--accent-hover)",
  fontWeight: "600",
};

const chipDot: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  flexShrink: 0,
};

const backLink: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "500",
  color: "var(--text-secondary)",
  textDecoration: "none",
};

const divider: React.CSSProperties = {
  width: "1px",
  height: "16px",
  background: "var(--border)",
};

const editorWrap: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  // Let Puck fill the remaining height
  display: "flex",
  flexDirection: "column",
};

const previewBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "5px 11px",
  borderRadius: "var(--radius-sm)",
  fontSize: "12px",
  fontWeight: "600",
  color: "var(--text-secondary)",
  background: "transparent",
  border: "1px solid var(--border)",
  cursor: "pointer",
  transition: "background 0.1s, color 0.1s, border-color 0.1s",
};

const previewBtnError: React.CSSProperties = {
  color: "var(--danger)",
  borderColor: "var(--danger)",
};


const readOnlyBadge: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  background: "var(--bg-overlay)",
  border: "1px solid var(--border)",
  padding: "2px 8px",
  borderRadius: "99px",
};

const spinner: React.CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  border: "2px solid currentColor",
  borderTopColor: "transparent",
  animation: "spin 0.6s linear infinite",
  marginRight: "6px",
  verticalAlign: "middle",
};
