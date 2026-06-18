import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, orgMembers, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { CampaignEditorClient } from "./CampaignEditorClient";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  const orgId = session.orgId!;
  const userId = session.userId!;

  const [campaign, membership, org] = await Promise.all([
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: {
        id: true, name: true, slug: true, status: true,
        scheduledAt: true, expiresAt: true, expiryRedirectUrl: true, theme: true,
      },
      with: {
        pages: { orderBy: (p, { asc }) => [asc(p.position)] },
        flowNodes: { with: { page: true } },
        flowEdges: { orderBy: (e, { asc }) => [asc(e.ruleOrder)] },
        audienceFields: { columns: { key: true } },
      },
    }),
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { slug: true },
    }),
  ]);

  if (!campaign) notFound();

  const canEdit = membership?.role === "owner" || membership?.role === "editor";

  return (
    <div style={page}>
      <header style={header}>
        <div style={breadcrumb}>
          <Link href="/campaigns" style={breadcrumbLink}>
            Campaigns
          </Link>
          <span style={breadcrumbSep}>/</span>
          <span style={breadcrumbCurrent}>{campaign.name}</span>
        </div>
        <StatusBadge status={campaign.status} />
      </header>

      <CampaignEditorClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        campaign={campaign as any}
        canEdit={canEdit}
        orgSlug={org?.slug ?? ""}
      />
    </div>
  );
}

const STATUS_BADGE_STYLES: Record<string, React.CSSProperties> = {
  draft:     { background: "var(--status-draft-bg)",  color: "var(--status-draft)",  border: "1px solid var(--status-draft-border)" },
  scheduled: { background: "var(--warning-muted)",    color: "var(--warning)",        border: "1px solid var(--warning)" },
  published: { background: "var(--success-muted)",    color: "var(--success)",        border: "1px solid var(--success)" },
  expired:   { background: "var(--danger-muted)",     color: "var(--danger)",         border: "1px solid var(--danger)" },
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "99px",
        fontSize: "11px",
        fontWeight: "600",
        letterSpacing: "0.05em",
        ...(STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.draft),
      }}
    >
      {status}
    </span>
  );
}

const page: React.CSSProperties = { padding: "28px 36px" };
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "28px",
};
const breadcrumb: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
};
const breadcrumbLink: React.CSSProperties = { color: "var(--text-secondary)" };
const breadcrumbSep: React.CSSProperties = { color: "var(--text-muted)" };
const breadcrumbCurrent: React.CSSProperties = {
  color: "var(--text-primary)",
  fontWeight: "500",
};
