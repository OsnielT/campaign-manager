import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AudienceClient } from "./AudienceClient";

export const metadata = { title: "Audience" };

export default async function AudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session.userId || !session.orgId) redirect("/login");

  const [campaign, membership] = await Promise.all([
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, session.orgId), eq(campaigns.slug, slug)),
      columns: { id: true, name: true, slug: true },
    }),
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, session.orgId), eq(orgMembers.userId, session.userId)),
    }),
  ]);

  if (!campaign) notFound();
  const canEdit = membership?.role === "owner" || membership?.role === "editor";

  return (
    <div style={{ padding: "28px 36px" }}>
      <nav style={{ fontSize: 13, marginBottom: 24, display: "flex", gap: 6, alignItems: "center" }}>
        <Link href="/campaigns" style={{ color: "var(--text-secondary)" }}>Campaigns</Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <Link href={`/campaigns/${slug}`} style={{ color: "var(--text-secondary)" }}>{campaign.name}</Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Audience</span>
      </nav>
      <AudienceClient campaignSlug={slug} canEdit={canEdit} />
    </div>
  );
}
