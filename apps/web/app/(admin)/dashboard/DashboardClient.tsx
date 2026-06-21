"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Settings2, ArrowRight, ArrowUp, ArrowDown, Check, X,
  Megaphone, Users, Zap, TrendingUp, MousePointerClick, Mail,
  AlertTriangle, Clock, CalendarClock, Webhook,
} from "lucide-react";
import type { DashboardMetrics, DashboardRange, Kpi, LeaderRow, AttentionItem } from "@/lib/dashboard/metrics";
import { Sparkline, AreaTrend, FunnelBars, MiniBar } from "@/components/charts";

interface Props {
  userName: string | null;
  org: { name: string; plan: string };
  initialMetrics: DashboardMetrics;
  checklist: { hasCampaign: boolean; hasComposedEntry: boolean; hasAudience: boolean; hasPublished: boolean };
  initialPrefs: { visible?: string[]; order?: string[] } | null;
}

const KPI_WIDGETS = ["total_campaigns", "conversions", "audience_added", "activation_rate", "emails_sent", "status_breakdown"] as const;
type WidgetId = (typeof KPI_WIDGETS)[number];

const WIDGET_LABELS: Record<WidgetId, string> = {
  total_campaigns: "Total Campaigns",
  conversions: "Conversions",
  audience_added: "Audience Added",
  activation_rate: "Activation Rate",
  emails_sent: "Emails Sent",
  status_breakdown: "Campaign Status",
};

const RANGES: { id: DashboardRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
];

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft: { background: "var(--status-draft-bg)", color: "var(--status-draft)", border: "1px solid var(--status-draft-border)" },
  scheduled: { background: "var(--warning-muted)", color: "var(--warning)", border: "1px solid var(--warning)" },
  published: { background: "var(--success-muted)", color: "var(--success)", border: "1px solid var(--success)" },
  expired: { background: "var(--danger-muted)", color: "var(--danger)", border: "1px solid var(--danger)" },
};

const ATTENTION_ICON: Record<AttentionItem["kind"], React.ElementType> = {
  broadcast_failed: AlertTriangle,
  broadcast_scheduled: Clock,
  campaign_expiring: CalendarClock,
  campaign_going_live: CalendarClock,
  webhook_failed: Webhook,
};

const LS_KEY = "dashboard_widgets_v2";

function getCsrf(): string {
  const m = document.cookie.split("; ").find((c) => c.startsWith("primitive_csrf="));
  return m ? decodeURIComponent(m.split("=")[1]) : "";
}

function orderedWidgets(order?: string[]): WidgetId[] {
  if (!order) return [...KPI_WIDGETS];
  const known = order.filter((id): id is WidgetId => (KPI_WIDGETS as readonly string[]).includes(id));
  const missing = KPI_WIDGETS.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

export function DashboardClient({ userName, org, initialMetrics, checklist, initialPrefs }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [range, setRange] = useState<DashboardRange>(initialMetrics.range);
  const [loading, setLoading] = useState(false);

  const [visible, setVisible] = useState<Set<WidgetId>>(
    new Set(initialPrefs?.visible ? (initialPrefs.visible as WidgetId[]) : KPI_WIDGETS),
  );
  const [order, setOrder] = useState<WidgetId[]>(orderedWidgets(initialPrefs?.order));
  const [configOpen, setConfigOpen] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [leaderMode, setLeaderMode] = useState<"top" | "recent">("top");

  useEffect(() => {
    setChecklistDismissed(localStorage.getItem("checklist_dismissed_v1") === "1");
  }, []);

  const persist = useCallback((nextVisible: Set<WidgetId>, nextOrder: WidgetId[]) => {
    const payload = { visible: [...nextVisible], order: nextOrder };
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    fetch("/api/me/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ dashboard: payload }),
    }).catch(() => { /* best-effort */ });
  }, []);

  async function changeRange(next: DashboardRange) {
    setRange(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?range=${next}`);
      if (res.ok) setMetrics(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function toggleWidget(id: WidgetId) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persist(next, order);
      return next;
    });
  }

  function moveWidget(id: WidgetId, dir: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      persist(visible, next);
      return next;
    });
  }

  const k = metrics.kpis;
  const showChecklist = !checklistDismissed && !checklist.hasPublished;
  const leaderRows = leaderMode === "top" ? metrics.leaderboard : metrics.recentCampaigns;

  return (
    <div style={{ ...page, opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
      {/* ── Header ── */}
      <header style={header}>
        <div>
          <h1 style={heading}>Dashboard</h1>
          <p style={sub}>Welcome back{userName ? `, ${userName}` : ""} · {org.name}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={rangeWrap}>
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => changeRange(r.id)} style={range === r.id ? rangeBtnActive : rangeBtn}>{r.label}</button>
            ))}
          </div>
          <span style={planBadge}>{org.plan}</span>
          <Link href="/campaigns/new" style={newCampaignBtn}><Plus size={14} strokeWidth={2.5} />New Campaign</Link>
        </div>
      </header>

      {showChecklist && (
        <GettingStartedChecklist checklist={checklist} onDismiss={() => { localStorage.setItem("checklist_dismissed_v1", "1"); setChecklistDismissed(true); }} />
      )}

      {/* ── Configure widgets ── */}
      <div style={{ marginBottom: 18 }}>
        <button onClick={() => setConfigOpen((o) => !o)} style={configToggleBtn}><Settings2 size={13} />Configure widgets</button>
        {configOpen && (
          <div style={configPanel}>
            <p style={configPanelTitle}>Show & reorder</p>
            {order.map((id) => (
              <div key={id} style={configRow}>
                <label style={configLabel}>
                  <input type="checkbox" checked={visible.has(id)} onChange={() => toggleWidget(id)} style={{ marginRight: 8, accentColor: "var(--accent)" }} />
                  {WIDGET_LABELS[id]}
                </label>
                <span style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => moveWidget(id, -1)} style={iconBtn} title="Move up"><ArrowUp size={13} /></button>
                  <button onClick={() => moveWidget(id, 1)} style={iconBtn} title="Move down"><ArrowDown size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={kpiGrid}>
        {order.filter((id) => visible.has(id)).map((id) => {
          if (id === "total_campaigns") return <KpiCard key={id} label="Total Campaigns" value={String(metrics.totalCampaigns)} Icon={Megaphone} />;
          if (id === "conversions") return <KpiCard key={id} label="Conversions" kpi={k.conversions} Icon={MousePointerClick} sparkColor="var(--accent)" />;
          if (id === "audience_added") return <KpiCard key={id} label="Audience Added" kpi={k.audienceAdded} Icon={Users} />;
          if (id === "activation_rate") return <KpiCard key={id} label="Activation Rate" kpi={k.activationRate} suffix="%" Icon={Zap} />;
          if (id === "emails_sent") return <KpiCard key={id} label="Emails Sent" kpi={k.emailsSent} Icon={Mail} />;
          if (id === "status_breakdown") return <StatusBreakdown key={id} statusCounts={metrics.statusCounts} />;
          return null;
        })}
      </div>

      {/* ── Needs attention ── */}
      {metrics.attention.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <h2 style={sectionHeading}>Needs attention</h2>
          <div style={{ ...tableWrap, marginTop: 12 }}>
            {metrics.attention.map((a, i) => {
              const Icon = ATTENTION_ICON[a.kind];
              const danger = a.kind === "broadcast_failed" || a.kind === "webhook_failed";
              return (
                <Link key={i} href={a.href as never} style={{ ...attentionRow, borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon size={15} style={{ color: danger ? "var(--danger)" : "var(--warning)" }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{a.label}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.detail}</span>
                    <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Analytics row ── */}
      <section style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <ChartCard title="Conversions over time">
          <AreaTrend data={metrics.timeseries} />
        </ChartCard>
        <ChartCard title="Conversion funnel">
          <FunnelBars data={[
            { stage: "Records", value: metrics.funnel.records },
            { stage: "Activations", value: metrics.funnel.activations },
            { stage: "Conversions", value: metrics.funnel.conversions },
          ]} />
        </ChartCard>
      </section>

      {/* ── Leaderboard / Recent ── */}
      <section style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <h2 style={sectionHeading}>Campaigns</h2>
            <div style={{ ...rangeWrap, marginLeft: 12 }}>
              <button onClick={() => setLeaderMode("top")} style={leaderMode === "top" ? rangeBtnActive : rangeBtn}>Top performing</button>
              <button onClick={() => setLeaderMode("recent")} style={leaderMode === "recent" ? rangeBtnActive : rangeBtn}>Recent</button>
            </div>
          </div>
          <Link href="/campaigns" style={viewAllLink}>View all <ArrowRight size={12} style={{ display: "inline", verticalAlign: "middle" }} /></Link>
        </div>
        {leaderRows.length === 0 ? (
          <div style={emptyState}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{leaderMode === "top" ? "No conversions in this period" : "No campaigns yet"}</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>{leaderMode === "top" ? "Try a wider date range or check back once visitors convert." : "Create your first campaign to get started."}</p>
            <Link href="/campaigns/new" style={newCampaignBtn}><Plus size={14} strokeWidth={2.5} />New Campaign</Link>
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead><tr>{["Name", "Status", "Records", "Activations", "Sessions", "Conversions", "Conv. rate", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {leaderRows.map((c: LeaderRow) => (
                  <tr key={c.id} style={tr}>
                    <td style={td}><Link href={`/campaigns/${c.slug}`} style={nameLink}>{c.name}</Link></td>
                    <td style={td}><span style={{ ...statusPill, ...(STATUS_STYLES[c.status] ?? {}) }}>{c.status}</span></td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.records.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.activations.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.sessions.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{c.conversions.toLocaleString()}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.convRate === null ? "—" : `${Math.round(c.convRate * 100)}%`}</td>
                    <td style={{ ...td, textAlign: "right" }}><Link href={`/campaigns/${c.slug}`} style={editLink}>Open <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Recent broadcasts ── */}
      {metrics.recentBroadcasts.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <h2 style={{ ...sectionHeading, marginBottom: 14 }}>Recent email broadcasts</h2>
          <div style={tableWrap}>
            <table style={table}>
              <thead><tr>{["Name", "Status", "Recipients", "Sent", "Failed", "When", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {metrics.recentBroadcasts.map((b) => (
                  <tr key={b.id} style={tr}>
                    <td style={{ ...td, fontWeight: 500 }}>{b.name}</td>
                    <td style={td}><span style={{ ...statusPill, ...broadcastStatusStyle(b.status) }}>{b.status}</span></td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{b.recipientCount.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-secondary)" }}>{b.sentCount.toLocaleString()}</td>
                    <td style={{ ...td, color: b.failedCount > 0 ? "var(--danger)" : "var(--text-secondary)" }}>{b.failedCount.toLocaleString()}</td>
                    <td style={{ ...td, color: "var(--text-muted)", fontSize: 12 }}>{b.sentAt ? new Date(b.sentAt).toLocaleDateString() : b.scheduledAt ? `→ ${new Date(b.scheduledAt).toLocaleDateString()}` : "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}><Link href={`/campaigns/${b.campaignSlug}/email/${b.id}`} style={editLink}>Open <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Status mix chart (full width footer) ── */}
      {metrics.totalCampaigns > 0 && (
        <section style={{ marginTop: 30 }}>
          <ChartCard title="Campaign status mix">
            <MiniBar data={[
              { label: "Published", value: metrics.statusCounts["published"] ?? 0, color: "var(--success)" },
              { label: "Scheduled", value: metrics.statusCounts["scheduled"] ?? 0, color: "var(--warning)" },
              { label: "Draft", value: metrics.statusCounts["draft"] ?? 0, color: "var(--text-muted)" },
              { label: "Expired", value: metrics.statusCounts["expired"] ?? 0, color: "var(--danger)" },
            ]} height={180} />
          </ChartCard>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ──

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>;
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: up ? "var(--success)" : "var(--danger)", display: "inline-flex", alignItems: "center", gap: 2 }}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(pct)}%
    </span>
  );
}

function KpiCard({ label, value, kpi, suffix, sparkColor, Icon }: { label: string; value?: string; kpi?: Kpi; suffix?: string; sparkColor?: string; Icon?: React.ElementType }) {
  const display = value ?? `${(kpi?.value ?? 0).toLocaleString()}${suffix ?? ""}`;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ ...cardLabel, marginBottom: 0 }}>{label}</p>
        {Icon && <Icon size={18} strokeWidth={1.8} style={{ color: "var(--text-muted)", opacity: 0.6 }} />}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <p style={cardValue}>{display}</p>
        {kpi && <Delta pct={kpi.deltaPct} />}
      </div>
      {kpi && kpi.series.length > 1 && <div style={{ marginTop: 8 }}><Sparkline data={kpi.series} color={sparkColor ?? "var(--text-muted)"} /></div>}
      {kpi && kpi.series.length <= 1 && <p style={cardSub}>vs. previous period</p>}
    </div>
  );
}

function StatusBreakdown({ statusCounts }: { statusCounts: Record<string, number> }) {
  return (
    <div style={card}>
      <p style={cardLabel}>Campaign Status</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {(["published", "scheduled", "draft", "expired"] as const).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...statusPill, ...(STATUS_STYLES[s] ?? {}) }}>{s}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{statusCounts[s] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <p style={{ ...cardLabel, marginBottom: 14 }}>{title}</p>
      {children}
    </div>
  );
}

function broadcastStatusStyle(status: string): React.CSSProperties {
  if (status === "sent") return STATUS_STYLES.published;
  if (status === "scheduled" || status === "sending") return STATUS_STYLES.scheduled;
  if (status === "failed") return STATUS_STYLES.expired;
  return STATUS_STYLES.draft;
}

function GettingStartedChecklist({ checklist, onDismiss }: { checklist: Props["checklist"]; onDismiss: () => void }) {
  const steps = [
    { done: true, label: "Create your organization", href: null as string | null },
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
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Getting started — {completed} of {steps.length} done</p>
          <div style={{ marginTop: 8, height: 4, background: "var(--border)", borderRadius: 99, width: 240 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px", display: "flex" }} title="Dismiss"><X size={14} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.done ? "var(--success)" : "var(--bg-raised)", border: s.done ? "none" : "1px solid var(--border)" }}>{s.done ? <Check size={10} color="var(--text-inverse)" strokeWidth={3} /> : null}</span>
            <span style={{ fontSize: 13, color: s.done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: s.done ? "line-through" : "none" }}>
              {s.href && !s.done ? <Link href={s.href as never} style={{ color: "var(--accent-hover)", textDecoration: "none" }}>{s.label}</Link> : s.label}
              {"optional" in s && s.optional && !s.done && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(optional)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ──
const page: React.CSSProperties = {
  padding: "36px 40px",
  minHeight: "100%",
  background: "radial-gradient(ellipse at 0% 0%, rgba(99,102,241,0.055) 0%, transparent 55%), var(--bg)",
};
const header: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 };
const heading: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontStyle: "italic",
  fontSize: 34,
  fontWeight: 600,
  color: "var(--text-primary)",
  letterSpacing: "-0.5px",
  lineHeight: 1.1,
};
const sub: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  marginTop: 6,
  letterSpacing: "0",
};
const planBadge: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  background: "var(--accent-muted)",
  color: "var(--accent)",
  padding: "4px 10px",
  borderRadius: 99,
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
};
const newCampaignBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "linear-gradient(100deg, #3525cd 0%, #6d28d9 55%, #4f46e5 100%)",
  color: "#ffffff",
  padding: "8px 18px",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "0 2px 8px rgba(53,37,205,0.28)",
  letterSpacing: "-0.01em",
};
const rangeWrap: React.CSSProperties = {
  display: "inline-flex",
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: 2,
};
const rangeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  cursor: "pointer",
  borderRadius: "calc(var(--radius-sm) - 2px)",
  letterSpacing: "0",
};
const rangeBtnActive: React.CSSProperties = {
  ...rangeBtn,
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  boxShadow: "var(--shadow-sm)",
  fontWeight: 600,
};
const configToggleBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "5px 12px",
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  letterSpacing: "0",
};
const configPanel: React.CSSProperties = {
  marginTop: 10,
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "12px 16px",
  display: "inline-block",
  minWidth: 260,
  boxShadow: "var(--shadow)",
};
const configPanelTitle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 10,
};
const configRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0" };
const configLabel: React.CSSProperties = { display: "flex", alignItems: "center", fontSize: 13, color: "var(--text-primary)", cursor: "pointer" };
const iconBtn: React.CSSProperties = { background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 4px", color: "var(--text-secondary)", cursor: "pointer", display: "flex" };
const kpiGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 };
const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "20px 22px",
  boxShadow: "var(--shadow-sm)",
};
const cardLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 8,
};
const cardValue: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 34,
  fontWeight: 600,
  color: "var(--text-primary)",
  letterSpacing: "-1px",
  lineHeight: 1,
};
const cardSub: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", marginTop: 6 };
const sectionHeading: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontStyle: "italic",
  fontSize: 18,
  fontWeight: 600,
  color: "var(--text-primary)",
  letterSpacing: "-0.3px",
};
const viewAllLink: React.CSSProperties = { fontSize: 12, color: "var(--accent-hover)", fontWeight: 600, textDecoration: "none" };
const tableWrap: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
  boxShadow: "var(--shadow-sm)",
};
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-raised)",
  whiteSpace: "nowrap",
};
const tr: React.CSSProperties = { borderBottom: "1px solid var(--border-subtle)" };
const td: React.CSSProperties = { padding: "13px 16px", fontSize: 13, color: "var(--text-primary)", verticalAlign: "middle" };
const nameLink: React.CSSProperties = { fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" };
const slugLabel: React.CSSProperties = { marginLeft: 8, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" };
const statusPill: React.CSSProperties = { display: "inline-block", padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" };
const editLink: React.CSSProperties = { fontSize: 12, color: "var(--accent-hover)", fontWeight: 600, textDecoration: "none" };
const attentionRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", textDecoration: "none" };
const emptyState: React.CSSProperties = {
  textAlign: "center",
  padding: "56px 24px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
};
const checklistCard: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
  borderRadius: "var(--radius-lg)",
  padding: "20px 22px",
  marginBottom: 24,
  boxShadow: "0 0 0 3px var(--accent-muted)",
};
