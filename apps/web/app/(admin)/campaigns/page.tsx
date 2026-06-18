import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowRight, TrendingUp } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, organizations } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { PLAN_LIMITS } from "@/lib/stripe/plans";
import type { Plan } from "@/lib/stripe/plans";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft:     { background: "var(--status-draft-bg)",  color: "var(--status-draft)",  border: "1px solid var(--status-draft-border)" },
  scheduled: { background: "var(--warning-muted)",    color: "var(--warning)",        border: "1px solid var(--warning)" },
  published: { background: "var(--success-muted)",    color: "var(--success)",        border: "1px solid var(--success)" },
  expired:   { background: "var(--danger-muted)",     color: "var(--danger)",         border: "1px solid var(--danger)" },
};

export default async function CampaignsPage() {
  const session = await getSession();
  const orgId = session.orgId!;

  const [rows, org, [{ total: campaignCount }]] = await Promise.all([
    db.query.campaigns.findMany({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)),
      orderBy: [desc(campaigns.updatedAt)],
      with: { pages: { columns: { id: true, isEntry: true } } },
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { plan: true },
    }),
    db.select({ total: count() }).from(campaigns).where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false))),
  ]);

  const plan = (org?.plan ?? "free") as Plan;
  const limit = PLAN_LIMITS[plan in PLAN_LIMITS ? plan : "free"].campaigns;
  const atLimit = limit !== Infinity && campaignCount >= limit;

  return (
    <div style={page}>
      <header style={header}>
        <h1 style={heading}>Campaigns</h1>
        {!atLimit && (
          <Link href="/campaigns/new" style={newBtn}>
            <Plus size={14} strokeWidth={2.5} />
            New campaign
          </Link>
        )}
      </header>

      {atLimit && (
        <div style={limitBanner}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              Campaign limit reached
            </span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 10 }}>
              Your {plan} plan includes up to {limit} campaigns.
            </span>
          </div>
          <Link href="/org/settings" style={upgradeLinkStyle}>
            <TrendingUp size={13} />
            Upgrade
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={emptyState}>
          <p style={emptyTitle}>No campaigns yet</p>
          <p style={emptySub}>Create your first campaign to get started.</p>
          <Link href="/campaigns/new" style={emptyBtn}>
            <Plus size={14} strokeWidth={2.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Create campaign
          </Link>
        </div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                {["Name", "Status", "Pages", "Updated", ""].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={tr}>
                  <td style={td}>
                    <Link href={`/campaigns/${c.slug}`} style={nameLink}>
                      {c.name}
                    </Link>
                    <span style={slugLabel}>/{c.slug}</span>
                  </td>
                  <td style={td}>
                    <span style={{ ...badge, ...(STATUS_STYLES[c.status] ?? {}) }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ ...td, color: "var(--text-secondary)" }}>
                    {c.pages.length}
                  </td>
                  <td style={{ ...td, color: "var(--text-muted)", fontSize: "12px" }}>
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Link href={`/campaigns/${c.slug}`} style={editLink}>
                      Edit <ArrowRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = { padding: "32px 36px" };
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "28px",
};
const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "600",
  color: "var(--text-primary)",
  letterSpacing: "-0.4px",
};
const newBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "var(--accent)",
  color: "var(--text-inverse)",
  padding: "8px 16px",
  borderRadius: "var(--radius)",
  fontSize: "13px",
  fontWeight: "600",
};
const tableWrap: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
};
const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};
const th: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border-subtle)",
  background: "var(--bg-raised)",
};
const tr: React.CSSProperties = {
  borderBottom: "1px solid var(--border-subtle)",
};
const td: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: "13px",
  color: "var(--text-primary)",
  verticalAlign: "middle",
};
const nameLink: React.CSSProperties = {
  fontWeight: "500",
  color: "var(--text-primary)",
};
const slugLabel: React.CSSProperties = {
  marginLeft: "8px",
  fontSize: "11px",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono, monospace)",
};
const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "99px",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.04em",
};
const editLink: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--accent-hover)",
  fontWeight: "500",
};
const emptyState: React.CSSProperties = {
  textAlign: "center",
  padding: "64px 24px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
};
const emptyTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "var(--text-primary)",
  marginBottom: "6px",
};
const emptySub: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  marginBottom: "24px",
};
const emptyBtn: React.CSSProperties = {
  display: "inline-block",
  background: "var(--accent)",
  color: "var(--text-inverse)",
  padding: "10px 20px",
  borderRadius: "var(--radius)",
  fontSize: "14px",
  fontWeight: "600",
};

const limitBanner: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  background: "var(--accent-muted)",
  border: "1px solid var(--accent-hover)",
  borderRadius: "var(--radius)",
  padding: "12px 18px",
  marginBottom: "20px",
};

const upgradeLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "var(--accent)",
  color: "var(--text-inverse)",
  padding: "6px 14px",
  borderRadius: "var(--radius-sm)",
  fontSize: "13px",
  fontWeight: "600",
  flexShrink: 0,
};
