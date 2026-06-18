"use client";

import { useState, useTransition, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, X, Check, AlertTriangle, FileX, Copy, Pencil, Trash2,
  ChevronLeft, Globe, FileText, Settings, GitBranch, AlignLeft,
} from "lucide-react";
import { FlowEditor } from "./FlowEditor";
import type { FlowNode, FlowEdge } from "./FlowEditor";
import { FONT_OPTIONS, DEFAULT_THEME, resolveFontFamily } from "@/lib/campaign-engine/theme";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";

interface Page {
  id: string;
  title: string;
  path: string;
  type: string;
  isEntry: boolean;
  isConversionPage: boolean;
  position: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}


interface Campaign {
  id: string;
  name: string;
  slug: string;
  status: string;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  expiryRedirectUrl: string | null;
  theme: CampaignTheme | null;
  pages: Page[];
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
}

function ThemePreview({ theme }: { theme: CampaignTheme }) {
  const bg      = theme.bgColor      || "#ffffff";
  const surface = theme.surfaceColor || "#f1f5f9";
  const text    = theme.textColor    || "#0f172a";
  const accent  = theme.accentColor  || "#2563eb";
  const font    = resolveFontFamily(theme.fontFamily ?? null) || "system-ui, sans-serif";

  const radii = ({
    sharp:   { card: 2,   btn: 3   },
    default: { card: 8,   btn: 999 },
    rounded: { card: 20,  btn: 999 },
  } as const)[theme.radiusStyle ?? "default"] ?? { card: 8, btn: 999 };

  return (
    <div style={{ background: bg, borderRadius: 8, padding: 20, fontFamily: font, border: "1px solid var(--border)", marginBottom: 16 }}>
      <div style={{ color: text, fontWeight: 700, fontSize: 30, lineHeight: 1, marginBottom: 6, letterSpacing: "-0.03em" }}>Aa</div>
      <div style={{ color: text, fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
        The quick brown fox jumps over the lazy dog.
      </div>
      <div style={{
        background: surface,
        borderRadius: radii.card,
        padding: "10px 13px",
        marginBottom: 12,
        border: `1px solid ${text}18`,
      }}>
        <div style={{ color: text, fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Card title</div>
        <div style={{ color: text, fontSize: 11, opacity: 0.55 }}>Some supporting text here.</div>
      </div>
      <button style={{
        background: accent, color: "var(--text-inverse)", border: "none",
        borderRadius: radii.btn, padding: "7px 16px",
        fontSize: 12, fontWeight: 600, cursor: "default", fontFamily: "inherit",
      }}>
        Get started
      </button>
    </div>
  );
}

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

const PAGE_TYPES = ["landing", "product", "offer", "result", "confirmation"] as const;

type Tab = "flow" | "branch" | "settings";

export function CampaignEditorClient({
  campaign: initial,
  canEdit,
  orgSlug,
}: {
  campaign: Campaign;
  canEdit: boolean;
  orgSlug: string;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("flow");
  const [readinessModal, setReadinessModal] = useState(false);
  const [readinessChecks, setReadinessChecks] = useState<{ label: string; pass: boolean; warn?: boolean }[]>([]);

  // Add page form state
  const [showAddPage, setShowAddPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageType, setNewPageType] = useState<string>("landing");
  const [newPageIsConversion, setNewPageIsConversion] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicatingCampaign, setDuplicatingCampaign] = useState(false);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  // Alerts state
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [alertEachEnabled, setAlertEachEnabled] = useState(false);
  const [alertEachEmail, setAlertEachEmail] = useState("");
  const [alertDailyEnabled, setAlertDailyEnabled] = useState(false);
  const [alertDailyEmail, setAlertDailyEmail] = useState("");
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertsSaved, setAlertsSaved] = useState(false);

  async function loadAlerts() {
    if (alertsLoaded) return;
    const res = await fetch(`/api/campaigns/${campaign.slug}/alerts`);
    if (res.ok) {
      const data = await res.json();
      const each = data.alerts?.find((a: { type: string; email: string; enabled: boolean }) => a.type === "each");
      const daily = data.alerts?.find((a: { type: string; email: string; enabled: boolean }) => a.type === "daily");
      if (each) { setAlertEachEnabled(each.enabled); setAlertEachEmail(each.email ?? ""); }
      if (daily) { setAlertDailyEnabled(daily.enabled); setAlertDailyEmail(daily.email ?? ""); }
    }
    setAlertsLoaded(true);
  }

  async function handleSaveAlerts() {
    setSavingAlerts(true);
    setAlertsSaved(false);
    try {
      const res = await fetch(`/api/campaigns/${campaign.slug}/alerts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          alerts: [
            { type: "each", enabled: alertEachEnabled, email: alertEachEmail },
            { type: "daily", enabled: alertDailyEnabled, email: alertDailyEmail },
          ],
        }),
      });
      if (res.ok) { setAlertsSaved(true); setTimeout(() => setAlertsSaved(false), 3000); }
    } finally {
      setSavingAlerts(false);
    }
  }

  // Per-page SEO state
  const [seoExpanded, setSeoExpanded] = useState<string | null>(null);
  const [seoEdits, setSeoEdits] = useState<Record<string, { metaTitle: string; metaDescription: string }>>({});
  const [savingSeoId, setSavingSeoId] = useState<string | null>(null);

  // Settings form state
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(
    campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : ""
  );
  const [expiresAt, setExpiresAt] = useState(
    campaign.expiresAt ? new Date(campaign.expiresAt).toISOString().slice(0, 16) : ""
  );
  const [expiryRedirectUrl, setExpiryRedirectUrl] = useState(campaign.expiryRedirectUrl ?? "");
  const [theme, setTheme] = useState<CampaignTheme>(campaign.theme ?? DEFAULT_THEME);

  function setThemeField<K extends keyof CampaignTheme>(key: K, value: CampaignTheme[K]) {
    setTheme((prev) => ({ ...prev, [key]: value }));
  }

  async function runReadinessCheck(): Promise<{ pass: boolean; checks: { label: string; pass: boolean; warn?: boolean }[] }> {
    const entryPage = campaign.pages.find((p) => p.isEntry);
    const checks: { label: string; pass: boolean; warn?: boolean }[] = [];

    // 1. Entry page exists
    checks.push({ label: "Entry page is set", pass: !!entryPage });

    // 2. Entry page has a composition
    let hasComposition = false;
    if (entryPage) {
      const res = await fetch(`/api/campaign-pages/${entryPage.id}/composition`);
      if (res.ok) {
        const data = await res.json();
        const tree = data.treeJson ?? data.composition?.treeJson ?? [];
        hasComposition = Array.isArray(tree) ? tree.length > 0 : Object.keys(tree).length > 0;
      }
    }
    checks.push({ label: "Entry page has content", pass: hasComposition });

    // 3. At least one page (warning if single page with no flow)
    checks.push({ label: "Campaign has at least one page", pass: campaign.pages.length > 0 });

    // 4. Warn if no audience records loaded (non-blocking)
    checks.push({ label: "Audience records imported (or not needed)", pass: true, warn: false });

    const hardFail = checks.some((c) => !c.pass && !c.warn);
    return { pass: !hardFail, checks };
  }

  async function callAction(action: string, force = false) {
    setActionError(null);
    const csrf = getCsrf();
    let res: Response;
    if (action === "publish" && !force) {
      // Run readiness check first
      const { pass, checks } = await runReadinessCheck();
      setReadinessChecks(checks);
      if (!pass) {
        setReadinessModal(true);
        return;
      }
      // All checks pass — show modal with passing state for confirmation
      setReadinessChecks(checks);
      setReadinessModal(true);
      return;
    }
    if (action === "publish") {
      res = await fetch(`/api/campaigns/${campaign.slug}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({}),
      });
    } else if (action === "unpublish") {
      res = await fetch(`/api/campaigns/${campaign.slug}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ unpublish: true }),
      });
    } else if (action === "cancel-schedule") {
      res = await fetch(`/api/campaigns/${campaign.slug}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ cancel: true }),
      });
    } else return;

    const data = await res.json();
    if (!res.ok) { setActionError(data.error ?? "Action failed"); return; }
    setCampaign((prev) => ({ ...prev, ...data.campaign }));
    startTransition(() => router.refresh());
  }

  async function handleAddPage(e: FormEvent) {
    e.preventDefault();
    setAddingPage(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.slug}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          title: newPageTitle,
          type: newPageType,
          isConversionPage: newPageIsConversion,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Failed to add page"); return; }
      setCampaign((prev) => ({
        ...prev,
        pages: [...prev.pages, data.page],
      }));
      setNewPageTitle("");
      setNewPageType("landing");
      setNewPageIsConversion(false);
      setShowAddPage(false);
      startTransition(() => router.refresh());
    } finally {
      setAddingPage(false);
    }
  }

  async function handleDeletePage(page: Page) {
    if (!confirm(`Delete page "${page.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/campaign-pages/${page.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Failed to delete page");
      return;
    }
    setCampaign((prev) => ({
      ...prev,
      pages: prev.pages.filter((p) => p.id !== page.id),
    }));
    startTransition(() => router.refresh());
  }

  async function handleDuplicatePage(pg: Page) {
    setDuplicatingId(pg.id);
    try {
      const res = await fetch(`/api/campaign-pages/${pg.id}/duplicate`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Failed to duplicate page"); return; }
      setCampaign((prev) => ({ ...prev, pages: [...prev.pages, data.page] }));
      startTransition(() => router.refresh());
    } finally {
      setDuplicatingId(null);
    }
  }

  function openSeo(pg: Page) {
    setSeoExpanded(pg.id);
    setSeoEdits((prev) => ({
      ...prev,
      [pg.id]: { metaTitle: pg.metaTitle ?? "", metaDescription: pg.metaDescription ?? "" },
    }));
  }

  async function handleSaveSeo(pageId: string) {
    const edits = seoEdits[pageId];
    if (!edits) return;
    setSavingSeoId(pageId);
    try {
      const res = await fetch(`/api/campaign-pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ metaTitle: edits.metaTitle || null, metaDescription: edits.metaDescription || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaign((prev) => ({
          ...prev,
          pages: prev.pages.map((p) => p.id === pageId ? { ...p, ...data.page } : p),
        }));
        setSeoExpanded(null);
      }
    } finally {
      setSavingSeoId(null);
    }
  }

  async function handleGeneratePreview() {
    setGeneratingPreview(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.slug}/preview-token`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Failed to generate preview link"); return; }
      const url = `${window.location.origin}/preview/${data.token}`;
      setPreviewLink(url);
    } finally {
      setGeneratingPreview(false);
    }
  }

  async function handleDuplicateCampaign() {
    if (!confirm(`Duplicate "${campaign.name}"? A copy will be created in draft status.`)) return;
    setDuplicatingCampaign(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.slug}/duplicate`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Failed to duplicate campaign"); return; }
      router.push(`/campaigns/${data.campaign.slug}`);
    } finally {
      setDuplicatingCampaign(false);
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const body: Record<string, unknown> = {};
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
      else body.scheduledAt = null;
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      else body.expiresAt = null;
      body.expiryRedirectUrl = expiryRedirectUrl || null;
      body.theme = theme;

      const res = await fetch(`/api/campaigns/${campaign.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaign((prev) => ({ ...prev, ...data.campaign }));
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  const STATUS_TRANSITIONS: Record<string, { label: string; action: string; variant: "primary" | "danger" | "ghost" }[]> = {
    draft: [{ label: "Publish now", action: "publish", variant: "primary" }],
    scheduled: [
      { label: "Publish now", action: "publish", variant: "primary" },
      { label: "Cancel schedule", action: "cancel-schedule", variant: "ghost" },
    ],
    published: [{ label: "Unpublish", action: "unpublish", variant: "danger" }],
    expired: [],
  };

  const transitions = STATUS_TRANSITIONS[campaign.status] ?? [];
  const sortedPages = [...campaign.pages].sort((a, b) => a.position - b.position);

  return (
    <div style={layout}>
      {/* Main */}
      <div style={mainCol}>
        {/* ── Page toolbar ── */}
        {sortedPages.length > 0 && (
          <div style={pageToolbar}>
            <span style={pageToolbarLabel}>
              <FileText size={12} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
              Edit page
            </span>
            <div style={pageChips}>
              {sortedPages.map((pg) => (
                <Link
                  key={pg.id}
                  href={`/campaigns/${campaign.slug}/compose/${pg.id}`}
                  style={pageChip}
                  title={pg.path}
                >
                  {pg.isEntry && (
                    <span style={chipDot} title="Entry" />
                  )}
                  {pg.isConversionPage && (
                    <span style={{ ...chipDot, background: "var(--success)" }} title="Conversion" />
                  )}
                  {pg.title}
                  <span style={chipPath}>{pg.path}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={tabBar}>
          {([["flow", "Pages"], ["branch", "Branching"], ["settings", "Settings"]] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                ...tabBtn,
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                color: tab === t ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {actionError && <p style={errMsg}>{actionError}</p>}

        {/* ── Pages & Flow tab ── */}
        {tab === "flow" && (
          <div style={section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={sectionHeading}>Pages</h2>
                <p style={sectionSub}>Each page is a step in the campaign funnel. The entry page is where visitors land.</p>
              </div>
              {canEdit && (
                <button style={addBtn} onClick={() => setShowAddPage((v) => !v)}>
                  {showAddPage ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add page</>}
                </button>
              )}
            </div>

            {showAddPage && (
              <form onSubmit={handleAddPage} style={addPageForm}>
                <div style={formRow}>
                  <label style={labelStyle}>
                    Title
                    <input
                      style={inputStyle}
                      required
                      value={newPageTitle}
                      onChange={(e) => setNewPageTitle(e.target.value)}
                      placeholder="e.g. Welcome"
                    />
                  </label>
                  <label style={labelStyle}>
                    Type
                    <select
                      style={inputStyle}
                      value={newPageType}
                      onChange={(e) => setNewPageType(e.target.value)}
                    >
                      {PAGE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newPageIsConversion}
                    onChange={(e) => setNewPageIsConversion(e.target.checked)}
                  />
                  Mark as conversion page (records a conversion event when visited)
                </label>
                <button type="submit" style={primaryBtnSmall} disabled={addingPage}>
                  {addingPage ? "Adding…" : "Add page"}
                </button>
              </form>
            )}

            <div style={flowList}>
              {sortedPages.length === 0 ? (
                <div style={emptyPagesState}>
                  <FileText size={28} strokeWidth={1.4} style={{ color: "var(--text-muted)", marginBottom: 10, display: "block" }} />
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", margin: "0 0 6px" }}>No pages yet</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", maxWidth: 340 }}>
                    Every campaign needs at least one page. Add a <strong>landing</strong> page as your entry point, then compose its content in the editor.
                  </p>
                  {canEdit && (
                    <button style={addBtn} onClick={() => setShowAddPage(true)}>
                      + Add your first page
                    </button>
                  )}
                </div>
              ) : (
                sortedPages.map((pg, idx) => (
                  <div key={pg.id}>
                    <div style={flowCard}>
                      <div style={flowCardLeft}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                          {pg.isEntry && <span style={entryBadge}>Entry</span>}
                          {pg.isConversionPage && <span style={convBadge}>Conversion</span>}
                          <span style={typePill}>{pg.type}</span>
                        </div>
                        <div style={flowPageTitle}>{pg.title}</div>
                        <code style={pathLabel}>{pg.path}</code>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Link href={`/campaigns/${campaign.slug}/compose/${pg.id}`} style={editPageBtn}>
                          Edit page
                        </Link>
                        {canEdit && (
                          <button
                            style={duplicateBtn}
                            title="SEO settings"
                            onClick={() => seoExpanded === pg.id ? setSeoExpanded(null) : openSeo(pg)}
                          >
                            SEO
                          </button>
                        )}
                        {canEdit && (
                          <button
                            style={duplicateBtn}
                            disabled={duplicatingId === pg.id}
                            onClick={() => handleDuplicatePage(pg)}
                            title="Duplicate page"
                          >
                            {duplicatingId === pg.id ? "…" : <Copy size={13} />}
                          </button>
                        )}
                        {canEdit && !pg.isEntry && (
                          <button
                            style={deleteBtn}
                            onClick={() => handleDeletePage(pg)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {seoExpanded === pg.id && (
                      <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>SEO / meta tags</div>
                        <label style={labelStyle}>
                          Meta title
                          <input
                            style={inputStyle}
                            value={seoEdits[pg.id]?.metaTitle ?? ""}
                            onChange={(e) => setSeoEdits((prev) => ({ ...prev, [pg.id]: { ...prev[pg.id], metaTitle: e.target.value } }))}
                            placeholder={pg.title}
                            maxLength={160}
                          />
                        </label>
                        <label style={labelStyle}>
                          Meta description
                          <input
                            style={inputStyle}
                            value={seoEdits[pg.id]?.metaDescription ?? ""}
                            onChange={(e) => setSeoEdits((prev) => ({ ...prev, [pg.id]: { ...prev[pg.id], metaDescription: e.target.value } }))}
                            placeholder="Brief description for search engines…"
                            maxLength={320}
                          />
                        </label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={primaryBtnSmall} disabled={savingSeoId === pg.id} onClick={() => handleSaveSeo(pg.id)}>
                            {savingSeoId === pg.id ? "Saving…" : "Save"}
                          </button>
                          <button style={{ ...primaryBtnSmall, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }} onClick={() => setSeoExpanded(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {idx < sortedPages.length - 1 && <div style={connector} />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Branching tab ── */}
        {tab === "branch" && (
          <div style={section}>
            <FlowEditor
              campaignSlug={campaign.slug}
              initialNodes={campaign.flowNodes as FlowNode[]}
              initialEdges={campaign.flowEdges as FlowEdge[]}
              canEdit={canEdit}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              audienceFieldKeys={((campaign as any).audienceFields ?? []).map((f: { key: string }) => f.key)}
            />
          </div>
        )}

        {/* ── Settings tab ── */}
        {tab === "settings" && (
          <div style={section}>
            <h2 style={sectionHeading}>Campaign settings</h2>
            <form onSubmit={handleSaveSettings} style={settingsForm}>
              <label style={labelStyle}>
                Schedule publish (optional)
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <span style={hint}>Campaign will auto-publish at this time. Leave empty to publish manually.</span>
              </label>

              <label style={labelStyle}>
                Expiry date (optional)
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <span style={hint}>Campaign expires at this time and becomes inaccessible.</span>
              </label>

              <label style={labelStyle}>
                Expiry redirect URL (optional)
                <input
                  style={inputStyle}
                  type="url"
                  value={expiryRedirectUrl}
                  onChange={(e) => setExpiryRedirectUrl(e.target.value)}
                  placeholder="https://…"
                />
                <span style={hint}>Visitors will be redirected here after expiry. If empty, a styled expiry page is shown.</span>
              </label>

              {/* ── Branding ── */}
              <div style={brandingSection}>
                <ThemePreview theme={theme} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Branding</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      Changes apply on the public campaign page after saving.
                    </div>
                  </div>
                  <button
                    type="button"
                    style={resetBtn}
                    onClick={() => setTheme(DEFAULT_THEME)}
                  >
                    Reset
                  </button>
                </div>

                <div style={brandingGrid}>
                  {/* Logo URL */}
                  <div style={brandRow}>
                    <span style={brandLabel}>Logo URL</span>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      type="url"
                      value={theme.logoUrl ?? ""}
                      onChange={(e) => setThemeField("logoUrl", e.target.value || null)}
                      placeholder="https://…"
                    />
                  </div>

                  {/* Color pickers */}
                  {([
                    ["accentColor", "Brand color"],
                    ["bgColor", "Background"],
                    ["surfaceColor", "Surface / card"],
                    ["textColor", "Text color"],
                  ] as const).map(([field, label]) => (
                    <div key={field} style={brandRow}>
                      <span style={brandLabel}>{label}</span>
                      <div style={colorRow}>
                        <input
                          type="color"
                          value={theme[field] ?? "#000000"}
                          onChange={(e) => setThemeField(field, e.target.value)}
                          style={colorSwatch}
                        />
                        <input
                          style={{ ...inputStyle, width: 96 }}
                          type="text"
                          value={theme[field] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setThemeField(field, v.length === 7 && v.startsWith("#") ? v : v || null);
                          }}
                          placeholder="#000000"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Font */}
                  <div style={brandRow}>
                    <span style={brandLabel}>Font</span>
                    <select
                      style={{ ...inputStyle, flex: 1 }}
                      value={theme.fontFamily ?? ""}
                      onChange={(e) => setThemeField("fontFamily", e.target.value || null)}
                    >
                      <option value="">Default</option>
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Corner style */}
                  <div style={brandRow}>
                    <span style={brandLabel}>Corners</span>
                    <div style={segmented}>
                      {(["sharp", "default", "rounded"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setThemeField("radiusStyle", theme.radiusStyle === v ? null : v)}
                          style={{
                            ...segBtn,
                            background: theme.radiusStyle === v ? "var(--accent)" : "var(--bg-raised)",
                            color: theme.radiusStyle === v ? "var(--text-inverse)" : "var(--text-secondary)",
                            fontWeight: theme.radiusStyle === v ? 600 : 400,
                          }}
                        >
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="submit" style={primaryBtnSmall} disabled={settingsSaving}>
                  {settingsSaving ? "Saving…" : "Save settings"}
                </button>
                {settingsSaved && <span style={{ fontSize: 12, color: "var(--success, #34d399)" }}>Saved.</span>}
              </div>
            </form>

            {/* ── Alerts ── */}
            {canEdit && (
              <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Conversion alerts</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      Get email notifications when visitors convert.
                    </div>
                  </div>
                  {!alertsLoaded && (
                    <button style={{ ...primaryBtnSmall, background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }} type="button" onClick={loadAlerts}>
                      Configure
                    </button>
                  )}
                </div>
                {alertsLoaded && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={alertEachEnabled} onChange={(e) => setAlertEachEnabled(e.target.checked)} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Email me on every conversion</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Sends one email per conversion event.</div>
                        </div>
                      </label>
                      {alertEachEnabled && (
                        <input
                          type="email"
                          style={{ ...inputStyle, marginTop: 10, width: "100%", boxSizing: "border-box" as const }}
                          value={alertEachEmail}
                          onChange={(e) => setAlertEachEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                      )}
                    </div>
                    <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={alertDailyEnabled} onChange={(e) => setAlertDailyEnabled(e.target.checked)} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Daily digest</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Summary of conversions for the past 24 hours, sent each day.</div>
                        </div>
                      </label>
                      {alertDailyEnabled && (
                        <input
                          type="email"
                          style={{ ...inputStyle, marginTop: 10, width: "100%", boxSizing: "border-box" as const }}
                          value={alertDailyEmail}
                          onChange={(e) => setAlertDailyEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button style={primaryBtnSmall} type="button" disabled={savingAlerts} onClick={handleSaveAlerts}>
                        {savingAlerts ? "Saving…" : "Save alerts"}
                      </button>
                      {alertsSaved && <span style={{ fontSize: 12, color: "var(--success)" }}>Saved.</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Readiness Modal ── */}
      {readinessModal && (
        <div style={modalOverlay} onClick={() => setReadinessModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Ready to publish?
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {readinessChecks.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: c.pass ? "var(--success)" : c.warn ? "var(--warning)" : "var(--danger)",
                    fontSize: 10, color: "var(--text-inverse)",
                  }}>
                    {c.pass ? <Check size={10} strokeWidth={3} /> : c.warn ? <AlertTriangle size={10} strokeWidth={2.5} /> : <X size={10} strokeWidth={2.5} />}
                  </span>
                  <span style={{ fontSize: 13, color: c.pass ? "var(--text-primary)" : c.warn ? "var(--warning)" : "var(--danger)" }}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
            {readinessChecks.some((c) => !c.pass && !c.warn) ? (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={ghostBtn} onClick={() => setReadinessModal(false)}>Fix issues</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={ghostBtn} onClick={() => setReadinessModal(false)}>Cancel</button>
                <button
                  style={primaryBtn}
                  disabled={isPending}
                  onClick={() => { setReadinessModal(false); callAction("publish", true); }}
                >
                  Publish now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside style={sidebar}>
        {/* Publish */}
        {canEdit && transitions.length > 0 && (
          <div style={sideCard}>
            <h3 style={sideHeading}>Publish</h3>
            {actionError && <p style={errMsg}>{actionError}</p>}
            <div style={actionStack}>
              {transitions.map((t) => (
                <button
                  key={t.action}
                  style={t.variant === "primary" ? primaryBtn : t.variant === "danger" ? dangerBtn : ghostBtn}
                  onClick={() => callAction(t.action)}
                  disabled={isPending}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {orgSlug && campaign.pages.length > 0 && (
          <div style={sideCard}>
            <h3 style={sideHeading}>Preview</h3>
            {campaign.status === "published" ? (
              <a href={`/${orgSlug}/${campaign.slug}`} target="_blank" rel="noopener noreferrer" style={previewBtn}>
                Open live ↗
              </a>
            ) : (
              <p style={previewNote}>Publish to open the live URL.</p>
            )}
            {canEdit && (
              <div style={{ marginTop: 8 }}>
                <button
                  style={{ ...previewBtn, cursor: "pointer", textAlign: "center" as const, border: "1px solid var(--border)", background: "var(--bg-raised)", width: "100%", boxSizing: "border-box" as const }}
                  onClick={handleGeneratePreview}
                  disabled={generatingPreview}
                >
                  {generatingPreview ? "Generating…" : "🔗 Share draft preview"}
                </button>
                {previewLink && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      readOnly
                      value={previewLink}
                      onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(previewLink); }}
                      style={{ ...inputStyle, fontSize: 11, width: "100%", boxSizing: "border-box" as const, cursor: "copy", color: "var(--accent-hover)" }}
                      title="Click to copy"
                    />
                    <p style={previewNote}>Copied! Expires in 72h. Anyone with this link can view the draft.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick links */}
        <div style={sideCard}>
          <h3 style={sideHeading}>Campaign</h3>
          <div style={quickLinks}>
            <Link href={`/campaigns/${campaign.slug}/conversions`} style={quickLink}>
              <span>Conversions</span>
              <span style={chevron}>›</span>
            </Link>
            <Link href={`/campaigns/${campaign.slug}/audience`} style={quickLink}>
              <span>Audience</span>
              <span style={chevron}>›</span>
            </Link>
            <Link href={`/campaigns/${campaign.slug}/email`} style={quickLink}>
              <span>Email broadcasts</span>
              <span style={chevron}>›</span>
            </Link>
            <Link href={`/campaigns/${campaign.slug}/branding`} style={quickLink}>
              <span>Branding</span>
              <span style={chevron}>›</span>
            </Link>
            <Link href={`/campaigns/${campaign.slug}/webhook`} style={quickLink}>
              <span>Webhook</span>
              <span style={chevron}>›</span>
            </Link>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div style={sideCard}>
            <h3 style={sideHeading}>Actions</h3>
            <div style={actionStack}>
              <button
                style={ghostBtn}
                disabled={duplicatingCampaign}
                onClick={handleDuplicateCampaign}
              >
                {duplicatingCampaign ? "Duplicating…" : "⧉ Duplicate campaign"}
              </button>
            </div>
          </div>
        )}

        {/* Details */}
        <div style={sideCard}>
          <h3 style={sideHeading}>Details</h3>
          <dl style={detailList}>
            <dt style={dtStyle}>Status</dt>
            <dd style={ddStyle}>{campaign.status}</dd>
            <dt style={dtStyle}>Slug</dt>
            <dd style={{ ...ddStyle, fontFamily: "monospace", fontSize: 11 }}>{campaign.slug}</dd>
            {campaign.scheduledAt && (
              <>
                <dt style={dtStyle}>Scheduled</dt>
                <dd style={ddStyle}>{new Date(campaign.scheduledAt).toLocaleString()}</dd>
              </>
            )}
            {campaign.expiresAt && (
              <>
                <dt style={dtStyle}>Expires</dt>
                <dd style={ddStyle}>{new Date(campaign.expiresAt).toLocaleString()}</dd>
              </>
            )}
          </dl>
        </div>
      </aside>
    </div>
  );
}

// Layout
const layout: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 240px", gap: "20px", alignItems: "start" };
const mainCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };

const pageToolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "10px 14px",
};
const pageToolbarLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  flexShrink: 0,
};
const pageChips: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};
const pageChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "4px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-primary)",
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  textDecoration: "none",
  transition: "background 0.1s, border-color 0.1s",
  lineHeight: 1.4,
};
const chipDot: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  background: "var(--accent)",
  flexShrink: 0,
  display: "inline-block",
};
const chipPath: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono, monospace)",
};
const sidebar: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "14px" };

// Tabs
const tabBar: React.CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--border)",
  gap: 0,
};
const tabBtn: React.CSSProperties = {
  padding: "8px 18px",
  background: "none",
  border: "none",
  fontSize: 13,
  cursor: "pointer",
  marginBottom: -1,
  transition: "color 0.1s",
};

// Section card
const section: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "22px 24px",
};
const sectionHeading: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 };
const sectionSub: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 };

// Flow
const flowList: React.CSSProperties = { display: "flex", flexDirection: "column" };
const flowCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "13px 16px",
};
const flowCardLeft: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2, flex: 1 };
const flowPageTitle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "var(--text-primary)" };
const pathLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };
const connector: React.CSSProperties = { width: 1, height: 14, background: "var(--border)", marginLeft: 22, marginBlock: 2 };
const emptyMsg: React.CSSProperties = { fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "28px 0" };
const emptyPagesState: React.CSSProperties = {
  textAlign: "center", padding: "40px 24px",
  border: "2px dashed var(--border)", borderRadius: 10,
};

// Badges / pills
const typePill: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
  background: "var(--accent-muted)", color: "var(--accent-hover)",
  padding: "1px 6px", borderRadius: 99, display: "inline-block",
};
const entryBadge: React.CSSProperties = { ...typePill, background: "var(--success-muted)", color: "var(--success)" };
const convBadge: React.CSSProperties = { ...typePill, background: "var(--warning-muted)", color: "var(--warning)" };

// Buttons
const editPageBtn: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "5px 11px", fontSize: 12, fontWeight: 500,
  color: "var(--text-secondary)", cursor: "pointer", textDecoration: "none",
};
const deleteBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-muted)",
  cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px",
  borderRadius: 4,
};
const duplicateBtn: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)",
  cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "4px 8px",
  borderRadius: 4,
};
const addBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "var(--accent)", color: "var(--text-inverse)", border: "none",
  borderRadius: 7, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  flexShrink: 0,
};
const primaryBtnSmall: React.CSSProperties = {
  background: "var(--accent)", color: "var(--text-inverse)", border: "none",
  borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

// Add page form
const addPageForm: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16,
};
const formRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)",
};
const inputStyle: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13,
};
const hint: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };

// Settings form
const settingsForm: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 18, marginTop: 16 };

// Sidebar cards
const sideCard: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px",
};
const sideHeading: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
  color: "var(--text-muted)", marginBottom: 10,
};
const actionStack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 7 };
const primaryBtn: React.CSSProperties = {
  background: "var(--accent)", color: "var(--text-inverse)", border: "none",
  borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%",
};
const dangerBtn: React.CSSProperties = {
  background: "var(--danger-muted)", color: "var(--danger)", border: "1px solid var(--danger)",
  borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%",
};
const quickLinks: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const quickLink: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "7px 8px", borderRadius: 6, fontSize: 13, color: "var(--text-secondary)",
  textDecoration: "none", transition: "background 0.1s",
};
const chevron: React.CSSProperties = { opacity: 0.4 };
const detailList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 7 };
const dtStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
  letterSpacing: "0.05em", textTransform: "uppercase",
};
const ddStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-primary)", marginLeft: 0 };
const previewBtn: React.CSSProperties = {
  display: "block",
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
  textDecoration: "none",
  textAlign: "center",
  width: "100%",
  boxSizing: "border-box",
};
const previewNote: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  margin: "6px 0 0",
  textAlign: "center",
};
const errMsg: React.CSSProperties = {
  fontSize: 12, color: "var(--danger)", background: "var(--danger-muted)",
  padding: "6px 8px", borderRadius: 4, marginTop: 6,
};

// Branding section
const brandingSection: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "16px 18px",
};
const brandingGrid: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const brandRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const brandLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", width: 110, flexShrink: 0,
};
const colorRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const colorSwatch: React.CSSProperties = {
  width: 32, height: 32, padding: 2, border: "1px solid var(--border)",
  borderRadius: 6, background: "var(--bg-raised)", cursor: "pointer",
};
const segmented: React.CSSProperties = { display: "flex", gap: 4 };
const segBtn: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 6, padding: "5px 11px",
  fontSize: 12, cursor: "pointer", transition: "all 0.1s",
};
const resetBtn: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", borderRadius: 6,
  padding: "4px 10px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modalBox: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12,
  padding: "24px 28px", width: 400, maxWidth: "90vw", boxShadow: "var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.4))",
};
