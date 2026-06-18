import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, orgMembers, emailBroadcasts, campaignAudienceFields, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { BroadcastEditor } from "./BroadcastEditor";
import type { EmailDesign } from "@/lib/email/design";
import type { RuleGroup } from "@/lib/campaign-engine/branch";
import { resolveBrand, type CampaignTheme } from "@/lib/campaign-engine/theme";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Broadcast" };
export const dynamic = "force-dynamic";

export default async function BroadcastPage({ params }: { params: Promise<{ slug: string; broadcastId: string }> }) {
  const { slug, broadcastId } = await params;
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
    db.query.organizations.findFirst({ where: eq(organizations.id, session.orgId), columns: { branding: true } }),
  ]);
  if (!campaign || !membership) notFound();

  const broadcast = await db.query.emailBroadcasts.findFirst({ where: eq(emailBroadcasts.id, broadcastId) });
  if (!broadcast || broadcast.campaignId !== campaign.id) notFound();

  const campaignTheme = resolveBrand(org?.branding ?? null, campaign.theme ?? null);

  const fields = await db.query.campaignAudienceFields.findMany({
    where: eq(campaignAudienceFields.campaignId, campaign.id),
    columns: { key: true, label: true },
    orderBy: (t, { asc }) => [asc(t.position)],
  });

  const canEdit = membership.role === "owner" || membership.role === "editor";

  return (
    <BroadcastEditor
      campaignSlug={slug}
      campaignName={campaign.name}
      canEdit={canEdit}
      mailConfigured={emailConfigured()}
      audienceFields={fields}
      campaignTheme={campaignTheme}
      broadcast={{
        id: broadcast.id,
        name: broadcast.name,
        subject: broadcast.subject,
        preheader: broadcast.preheader,
        status: broadcast.status,
        scheduledAt: broadcast.scheduledAt ? broadcast.scheduledAt.toISOString() : null,
        recipientCount: broadcast.recipientCount,
        sentCount: broadcast.sentCount,
        failedCount: broadcast.failedCount,
        designJson: broadcast.designJson as EmailDesign,
        segmentFilter: (broadcast.segmentFilter as RuleGroup | null) ?? null,
        themeOverride: (broadcast.themeOverride as Partial<CampaignTheme> | null) ?? null,
      }}
    />
  );
}
