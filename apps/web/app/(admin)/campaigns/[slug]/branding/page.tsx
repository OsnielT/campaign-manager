import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, organizations, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";
import { BrandingTabClient } from "./BrandingTabClient";

export const metadata = { title: "Branding" };

export default async function CampaignBrandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session.userId || !session.orgId) redirect("/login");

  const [campaign, membership, org] = await Promise.all([
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, session.orgId), eq(campaigns.slug, slug)),
      columns: { id: true, name: true, slug: true, theme: true },
    }),
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, session.orgId), eq(orgMembers.userId, session.userId)),
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, session.orgId),
      columns: { branding: true },
    }),
  ]);

  if (!campaign) notFound();
  if (membership?.role !== "owner" && membership?.role !== "editor") redirect(`/campaigns/${slug}`);

  return (
    <div style={{ padding: "28px 36px", maxWidth: 760 }}>
      <nav style={{ fontSize: 13, marginBottom: 24, display: "flex", gap: 6, alignItems: "center" }}>
        <Link href="/campaigns" style={{ color: "var(--text-secondary)" }}>Campaigns</Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <Link href={`/campaigns/${slug}`} style={{ color: "var(--text-secondary)" }}>{campaign.name}</Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Branding</span>
      </nav>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.4px", marginBottom: 6 }}>
        Branding
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
        This campaign inherits your organization&apos;s brand. Override any field below — cleared fields fall back to the org default. All pages and elements update automatically.
      </p>
      <BrandingTabClient
        campaignSlug={slug}
        initialTheme={(campaign.theme as CampaignTheme | null) ?? null}
        orgBranding={(org?.branding as CampaignTheme | null) ?? null}
      />
    </div>
  );
}
