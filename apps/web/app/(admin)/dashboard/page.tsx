import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, campaignPages, campaignPageCompositions, organizations, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getDashboardMetrics } from "@/lib/dashboard/metrics";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  const orgId = session.orgId!;

  const [org, user, metrics] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, name: true, plan: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.userId!),
      columns: { name: true, dashboardPrefs: true },
    }),
    getDashboardMetrics(orgId, "30d"),
  ]);

  // Checklist: has an entry page with a non-empty composition?
  const composedEntries = await db
    .select({ id: campaignPageCompositions.campaignPageId })
    .from(campaignPageCompositions)
    .innerJoin(campaignPages, eq(campaignPageCompositions.campaignPageId, campaignPages.id))
    .innerJoin(campaigns, eq(campaignPages.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.orgId, orgId),
        eq(campaigns.isTemplate, false),
        eq(campaignPages.isEntry, true),
        sql`${campaignPageCompositions.treeJson} IS NOT NULL AND jsonb_typeof(${campaignPageCompositions.treeJson}::jsonb) != 'null' AND jsonb_array_length((${campaignPageCompositions.treeJson}::jsonb -> 'content')) > 0`
      )
    )
    .limit(1);

  const checklist = {
    hasCampaign: metrics.totalCampaigns > 0,
    hasComposedEntry: composedEntries.length > 0,
    hasAudience: metrics.funnel.records > 0,
    hasPublished: (metrics.statusCounts["published"] ?? 0) > 0,
  };

  const prefs = (user?.dashboardPrefs as { dashboard?: { visible?: string[]; order?: string[] } } | null)?.dashboard ?? null;

  return (
    <DashboardClient
      userName={user?.name ?? null}
      org={{ name: org?.name ?? "", plan: org?.plan ?? "free" }}
      initialMetrics={metrics}
      checklist={checklist}
      initialPrefs={prefs}
    />
  );
}
