import { db } from "@/lib/db";
import { campaigns, emailBroadcasts, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** Resolve a broadcast for an admin request, verifying org + campaign + membership. */
export async function resolveBroadcast(slug: string, id: string, userId: string, orgId: string) {
  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({ where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)) }),
    db.query.campaigns.findFirst({ where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)), columns: { id: true } }),
  ]);
  if (!membership || !campaign) return { membership, campaign, broadcast: null };
  const broadcast = await db.query.emailBroadcasts.findFirst({ where: eq(emailBroadcasts.id, id) });
  if (!broadcast || broadcast.campaignId !== campaign.id) return { membership, campaign, broadcast: null };
  return { membership, campaign, broadcast };
}
