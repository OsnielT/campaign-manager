import type { Metadata } from "next";
import Link from "next/link";
import { Plus, LayoutTemplate, GitBranch, ArrowRight, FileStack } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const session = await getSession();
  const orgId = session.orgId!;

  const rows = await db.query.campaigns.findMany({
    where: and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, true)),
    orderBy: [desc(campaigns.updatedAt)],
    with: {
      pages: { columns: { id: true } },
      flowNodes: { columns: { id: true, type: true } },
    },
  });

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={heading}>Templates</h1>
          <p style={sub}>Build reusable campaign structures. Select a template when creating a new campaign.</p>
        </div>
        <Link href="/templates/new" style={newBtn}>
          <Plus size={14} strokeWidth={2.5} />
          New template
        </Link>
      </header>

      {rows.length === 0 ? (
        <div style={emptyState}>
          <FileStack size={32} strokeWidth={1.4} style={{ margin: "0 auto 12px", color: "var(--text-muted)", display: "block" }} />
          <p style={emptyTitle}>No templates yet</p>
          <p style={emptySub}>Create a template to speed up future campaign creation.</p>
          <Link href="/templates/new" style={emptyBtn}>
            <Plus size={14} strokeWidth={2.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Create template
          </Link>
        </div>
      ) : (
        <div style={grid}>
          {rows.map((t) => {
            const branchCount = t.flowNodes.filter((n) => n.type === "branch").length;
            return (
              <div key={t.id} style={card}>
                <div style={cardTop}>
                  <div style={templateIconWrap}>
                    <LayoutTemplate size={16} strokeWidth={1.8} style={{ color: "var(--accent-hover)" }} />
                  </div>
                  <div style={cardMeta}>
                    <span style={pageCount}>{t.pages.length} {t.pages.length === 1 ? "page" : "pages"}</span>
                    {branchCount > 0 && (
                      <span style={branchBadge}>
                        <GitBranch size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                        {branchCount}
                      </span>
                    )}
                  </div>
                </div>
                <div style={cardName}>{t.name}</div>
                <div style={cardActions}>
                  <Link href={`/campaigns/${t.slug}`} style={editBtn}>
                    Edit <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = { padding: "32px 36px" };
const header: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" };
const heading: React.CSSProperties = { fontSize: "22px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.4px", marginBottom: "4px" };
const sub: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)" };
const newBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px", background: "var(--accent)", color: "var(--text-inverse)", padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "13px", fontWeight: "600", flexShrink: 0 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" };
const card: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px" };
const cardTop: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" };
const templateIconWrap: React.CSSProperties = { width: "32px", height: "32px", borderRadius: "var(--radius-sm)", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" };
const cardMeta: React.CSSProperties = { display: "flex", gap: "6px", alignItems: "center" };
const pageCount: React.CSSProperties = { fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "99px", padding: "2px 8px" };
const branchBadge: React.CSSProperties = { fontSize: "11px", fontWeight: "600", color: "var(--accent-hover)", background: "var(--accent-muted)", border: "1px solid var(--accent-hover)", borderRadius: "99px", padding: "2px 8px" };
const cardName: React.CSSProperties = { fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "16px", letterSpacing: "-0.2px" };
const cardActions: React.CSSProperties = { display: "flex", gap: "8px" };
const editBtn: React.CSSProperties = { fontSize: "12px", fontWeight: "500", color: "var(--accent-hover)" };
const emptyState: React.CSSProperties = { textAlign: "center", padding: "64px 24px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" };
const emptyTitle: React.CSSProperties = { fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" };
const emptySub: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" };
const emptyBtn: React.CSSProperties = { display: "inline-block", background: "var(--accent)", color: "var(--text-inverse)", padding: "10px 20px", borderRadius: "var(--radius)", fontSize: "14px", fontWeight: "600" };
