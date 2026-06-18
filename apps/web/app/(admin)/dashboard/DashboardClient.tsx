"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Settings2,
  ArrowRight,
  Check,
  X,
  Megaphone,
  Users,
  Zap,
  TrendingUp,
  MousePointerClick,
} from "lucide-react";

interface RecentCampaign {
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: string;
  records: number;
  activations: number;
  conversions: number;
}

interface ChecklistState {
  hasCampaign: boolean;
  hasComposedEntry: boolean;
  hasAudience: boolean;
  hasPublished: boolean;
}

interface Props {
  userName: string | null;
  org: { name: string; plan: string };
  statusCounts: Record<string, number>;
  totalRecords: number;
  totalActivations: number;
  totalConversions: number;
  recentCampaigns: RecentCampaign[];
  checklist: ChecklistState;
}

const ALL_WIDGET_IDS = [
  "total_campaigns",
  "status_breakdown",
  "total_records",
  "total_activations",
  "activation_rate",
  "total_conversions",
] as const;

type WidgetId = (typeof ALL_WIDGET_IDS)[number];

const WIDGET_LABELS: Record<WidgetId, string> = {
  total_campaigns: "Total Campaigns",
  status_breakdown: "By Status",
  total_records: "Audience Records",
  total_activations: "Activations",
  activation_rate: "Activation Rate",
  total_conversions: "Conversions",
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft: { background: "var(--status-draft-bg)", color: "var(--status-draft)", border: "1px solid var(--status-draft-border)" },
  scheduled: { background: "var(--warning-muted)", color: "var(--warning)", border: "1px solid var(--warning)" },
  published: { background: "var(--success-muted)", color: "var(--success)", border: "1px solid var(--success)" },
  expired: { background: "var(--danger-muted)", color: "var(--danger)", border: "1px solid var(--danger)" },
};

const LS_KEY = "dashboard_widgets_v1";

function loadVisible(): Set<WidgetId> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed as WidgetId[]);
    }
  } catch {
    // ignore
  }
  return new Set(ALL_WIDGET_IDS);
}

export function DashboardClient({
  userName,
  org,
  statusCounts,
  totalRecords,
  totalActivations,
  totalConversions,
  recentCampaigns,
  checklist,
}: Props) {
  const totalCampaigns = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const activationRate = totalRecords > 0
    ? Math.round((totalActivations / totalRecords) * 100)
    : 0;

  const [visibleWidgets, setVisibleWidgets] = useState<Set<WidgetId>>(new Set(ALL_WIDGET_IDS));
  const [configOpen, setConfigOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);

  useEffect(() => {
    setVisibleWidgets(loadVisible());
    setHydrated(true);
    setChecklistDismissed(localStorage.getItem("checklist_dismissed_v1") === "1");
  }, []);

  function toggleWidget(id: WidgetId) {
    setVisibleWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const show = (id: WidgetId) => !hydrated || visibleWidgets.has(id);

  return (
    <div style={page}>
      {/* ── Header ── */}
      <header style={header}>
        <div>
          <h1 style={heading}>Dashboard</h1>
          <p style={sub}>Welcome back{userName ? `, ${userName}` : ""} · {org.name}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={planBadge}>{org.plan}</span>
          <Link href="/campaigns/new" style={newCampaignBtn}>
            <Plus size={14} strokeWidth={2.5} />
            New Campaign
          </Link>
        </div>
      </header>

      {/* ── Getting Started Checklist ── */}
      {hydrated && !checklistDismissed && !checklist.hasPublished && (
        <GettingStartedChecklist
          checklist={checklist}
          onDismiss={() => {
            localStorage.setItem("checklist_dismissed_v1", "1");
            setChecklistDismissed(true);
          }}
        />
      )}

      {/* ── Configure widgets ── */}
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button
          onClick={() => setConfigOpen((o) => !o)}
          style={configToggleBtn}
        >
          <Settings2 size={13} />
          Configure widgets
        </button>

        {configOpen && (
          <div style={configPanel}>
            <p style={configPanelTitle}>Toggle widgets</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px" }}>
              {ALL_WIDGET_IDS.map((id) => (
                <label key={id} style={configLabel}>
                  <input
                    type="checkbox"
                    checked={visibleWidgets.has(id)}
                    onChange={() => toggleWidget(id)}
                    style={{ marginRight: 6, accentColor: "var(--accent)" }}
                  />
                  {WIDGET_LABELS[id]}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      {ALL_WIDGET_IDS.some(show) && (
        <div style={kpiGrid}>
          {show("total_campaigns") && (
            <KpiCard label="Total Campaigns" value={String(totalCampaigns)} Icon={Megaphone} />
          )}

          {show("status_breakdown") && (
            <div style={card}>
              <p style={cardLabel}>By Status</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {(["published", "scheduled", "draft", "expired"] as const).map((s) => {
                  const cnt = statusCounts[s] ?? 0;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ ...statusPill, ...(STATUS_STYLES[s] ?? {}) }}>{s}</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {show("total_records") && (
            <KpiCard label="Audience Records" value={totalRecords.toLocaleString()} sub="Total imported" Icon={Users} />
          )}

          {show("total_activations") && (
            <KpiCard label="Activations" value={totalActivations.toLocaleString()} sub="Records activated" Icon={Zap} />
          )}

          {show("activation_rate") && (
            <KpiCard label="Activation Rate" value={`${activationRate}%`} sub={totalRecords === 0 ? "No records yet" : `${totalActivations} of ${totalRecords}`} Icon={TrendingUp} />
          )}

          {show("total_conversions") && (
            <KpiCard label="Conversions" value={totalConversions.toLocaleString()} sub="Total events" Icon={MousePointerClick} />
          )}
        </div>
      )}

      {/* ── Recent Campaigns ── */}
      <section style={{ marginTop: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={sectionHeading}>Recent Campaigns</h2>
          <Link href="/campaigns" style={viewAllLink}>
            View all <ArrowRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />
          </Link>
        </div>

        {recentCampaigns.length === 0 ? (
          <div style={emptyState}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No campaigns yet</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Create your first campaign to get started.</p>
            <Link href="/campaigns/new" style={newCampaignBtn}>
            <Plus size={14} strokeWidth={2.5} />
            New Campaign
          </Link>
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  {["Name", "Status", "Records", "Activations", "Conversions", "Updated", ""].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c) => (
                  <tr key={c.id} style={tr}>
                    <td style={td}>
                      <Link href={`/campaigns/${c.slug}`} style={nameLink}>{c.name}</Link>
                      <span style={slugLabel}>/{c.slug}</span>
                    </td>
                    <td style={td}>
                      <span style={{ ...statusPill, ...(STATUS_STYLES[c.status] ?? {}) }}>{c.status}</span>
                    </td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.records.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.activations.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.conversions.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-muted)", fontSize: 12 }}>
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <Link href={`/campaigns/${c.slug}`} style={editLink}>
                      Edit <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} />
                    </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function GettingStartedChecklist({
  checklist,
  onDismiss,
}: {
  checklist: ChecklistState;
  onDismiss: () => void;
}) {
  const steps = [
    { done: true, label: "Create your organization", href: null },
    { done: checklist.hasCampaign, label: "Create your first campaign", href: "/campaigns/new" },
    { done: checklist.hasComposedEntry, label: "Compose an entry page", href: checklist.hasCampaign ? "/campaigns" : "/campaigns/new" },
    { done: checklist.hasAudience, label: "Import an audience (or skip)", href: checklist.hasCampaign ? "/campaigns" : null, optional: true },
    { done: checklist.hasPublished, label: "Publish your campaign", href: checklist.hasCampaign ? "/campaigns" : null },
  ];
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div style={checklistCard}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Getting started — {completed} of {steps.length} done
          </p>
          <div style={{ marginTop: 8, height: 4, background: "var(--border)", borderRadius: 99, width: 240 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center" }} title="Dismiss"><X size={14} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: s.done ? "var(--success)" : "var(--bg-raised)", border: s.done ? "none" : "1px solid var(--border)",
            }}>{s.done ? <Check size={10} color="var(--text-inverse)" strokeWidth={3} /> : null}</span>
            <span style={{ fontSize: 13, color: s.done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: s.done ? "line-through" : "none" }}>
              {s.href && !s.done ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <Link href={s.href as any} style={{ color: "var(--accent-hover)", textDecoration: "none" }}>{s.label}</Link>
              ) : s.label}
              {s.optional && !s.done && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(optional)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const checklistCard: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
  marginBottom: 20,
  boxShadow: "0 0 0 3px var(--accent-muted)",
};

function KpiCard({ label, value, sub, Icon }: { label: string; value: string; sub?: string; Icon?: React.ElementType }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ ...cardLabel, marginBottom: 0 }}>{label}</p>
        {Icon && <Icon size={20} strokeWidth={1.8} style={{ color: "var(--text-muted)", opacity: 0.6 }} />}
      </div>
      <p style={cardValue}>{value}</p>
      {sub && <p style={cardSub}>{sub}</p>}
    </div>
  );
}

// ── Styles ──

const page: React.CSSProperties = { padding: "32px 36px" };

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: 28,
};

const heading: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: "var(--text-primary)",
  letterSpacing: "-0.4px",
};

const sub: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  marginTop: 4,
};

const planBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  background: "var(--accent-muted)",
  color: "var(--accent-hover)",
  padding: "4px 10px",
  borderRadius: 99,
  border: "1px solid var(--accent)",
};

const newCampaignBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "var(--accent)",
  color: "var(--text-inverse)",
  padding: "8px 16px",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const configToggleBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "5px 12px",
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const configPanel: React.CSSProperties = {
  marginTop: 10,
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "14px 18px",
  display: "inline-block",
};

const configPanelTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 10,
};

const configLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: 13,
  color: "var(--text-primary)",
  cursor: "pointer",
};

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "20px 22px",
  boxShadow: "var(--shadow-sm)",
};

const cardLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 8,
};

const cardValue: React.CSSProperties = {
  fontSize: '3vw',
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "-0.5px",
  lineHeight: 1,
};

const cardSub: React.CSSProperties = {
  fontSize: '1vw',
  color: "var(--text-muted)",
  marginTop: 6,
};

const sectionHeading: React.CSSProperties = {
  fontSize: '15',
  fontWeight: 600,
  color: "var(--text-primary)",
  letterSpacing: "-0.2px",
};

const viewAllLink: React.CSSProperties = {
  fontSize: 12,
  color: "var(--accent-hover)",
  fontWeight: 500,
  textDecoration: "none",
};

const tableWrap: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
  boxShadow: "var(--shadow-sm)",
};

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };

const th: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-raised)",
  whiteSpace: "nowrap",
};

const tr: React.CSSProperties = { borderBottom: "1px solid var(--border-subtle)" };

const td: React.CSSProperties = {
  padding: "13px 16px",
  fontSize: 13,
  color: "var(--text-primary)",
  verticalAlign: "middle",
};

const nameLink: React.CSSProperties = {
  fontWeight: 500,
  color: "var(--text-primary)",
  textDecoration: "none",
};

const slugLabel: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 11,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono, monospace)",
};

const statusPill: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 99,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
};

const editLink: React.CSSProperties = {
  fontSize: 12,
  color: "var(--accent-hover)",
  fontWeight: 500,
  textDecoration: "none",
};

const emptyState: React.CSSProperties = {
  textAlign: "center",
  padding: "52px 24px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
};
