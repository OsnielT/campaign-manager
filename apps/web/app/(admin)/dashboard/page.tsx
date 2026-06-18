import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, campaignAudienceRecords, campaignConversions, campaignPages, campaignPageCompositions, organizations, users } from "@/lib/db/schema";
import { eq, and, inArray, count, desc, sql } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  const orgId = session.orgId!;

  // 1. Core org + user info
  const [org, user] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, name: true, plan: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.userId!),
      columns: { name: true },
    }),
  ]);

  // 2. Campaign status breakdown (templates excluded)
  const statusRows = await db
    .select({ status: campaigns.status, cnt: count() })
    .from(campaigns)
    .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)))
    .groupBy(campaigns.status);

  const statusCounts: Record<string, number> = {};
  for (const row of statusRows) statusCounts[row.status] = Number(row.cnt);

  // 3. Org-wide audience + activation + conversion aggregates
  const [
    [{ totalRecords }],
    [{ totalActivations }],
    [{ totalConversions }],
  ] = await Promise.all([
    db
      .select({ totalRecords: sql<number>`count(*)::int` })
      .from(campaignAudienceRecords)
      .innerJoin(campaigns, eq(campaignAudienceRecords.campaignId, campaigns.id))
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false))),

    db
      .select({ totalActivations: sql<number>`count(*)::int` })
      .from(campaignAudienceRecords)
      .innerJoin(campaigns, eq(campaignAudienceRecords.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTemplate, false),
          sql`${campaignAudienceRecords.fields}->>'_activated_at' != ''`
        )
      ),

    db
      .select({ totalConversions: sql<number>`count(*)::int` })
      .from(campaignConversions)
      .innerJoin(campaigns, eq(campaignConversions.campaignId, campaigns.id))
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false))),
  ]);

  // 4. Checklist: check if any entry page has a non-empty composition
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
    hasCampaign: Object.values(statusCounts).reduce((a, b) => a + b, 0) > 0,
    hasComposedEntry: composedEntries.length > 0,
    hasAudience: (totalRecords ?? 0) > 0,
    hasPublished: (statusCounts["published"] ?? 0) > 0,
  };

  // 5. Last 5 campaigns (templates excluded)
  const recentRows = await db.query.campaigns.findMany({
    where: and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)),
    orderBy: [desc(campaigns.updatedAt)],
    limit: 5,
    columns: { id: true, name: true, slug: true, status: true, updatedAt: true },
  });

  const recentCampaigns = recentRows.map((c) => ({
    ...c,
    updatedAt: c.updatedAt.toISOString(),
    records: 0,
    activations: 0,
    conversions: 0,
  }));

  // 5. Per-campaign stats for the 5 recent campaigns
  if (recentRows.length > 0) {
    const ids = recentRows.map((c) => c.id);

    const [recordCounts, activationCounts, conversionCounts] = await Promise.all([
      db
        .select({ campaignId: campaignAudienceRecords.campaignId, cnt: sql<number>`count(*)::int` })
        .from(campaignAudienceRecords)
        .where(inArray(campaignAudienceRecords.campaignId, ids))
        .groupBy(campaignAudienceRecords.campaignId),

      db
        .select({ campaignId: campaignAudienceRecords.campaignId, cnt: sql<number>`count(*)::int` })
        .from(campaignAudienceRecords)
        .where(
          and(
            inArray(campaignAudienceRecords.campaignId, ids),
            sql`${campaignAudienceRecords.fields}->>'_activated_at' != ''`
          )
        )
        .groupBy(campaignAudienceRecords.campaignId),

      db
        .select({ campaignId: campaignConversions.campaignId, cnt: sql<number>`count(*)::int` })
        .from(campaignConversions)
        .where(inArray(campaignConversions.campaignId, ids))
        .groupBy(campaignConversions.campaignId),
    ]);

    const recMap = Object.fromEntries(recordCounts.map((r) => [r.campaignId, r.cnt]));
    const actMap = Object.fromEntries(activationCounts.map((r) => [r.campaignId, r.cnt]));
    const convMap = Object.fromEntries(conversionCounts.map((r) => [r.campaignId, r.cnt]));

    for (const c of recentCampaigns) {
      c.records = recMap[c.id] ?? 0;
      c.activations = actMap[c.id] ?? 0;
      c.conversions = convMap[c.id] ?? 0;
    }
  }

  return (
    <DashboardClient
      userName={user?.name ?? null}
      org={{ name: org?.name ?? "", plan: org?.plan ?? "free" }}
      statusCounts={statusCounts}
      totalRecords={totalRecords ?? 0}
      totalActivations={totalActivations ?? 0}
      totalConversions={totalConversions ?? 0}
      recentCampaigns={recentCampaigns}
      checklist={checklist}
    />
  );
}
