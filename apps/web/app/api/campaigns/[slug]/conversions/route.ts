import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignConversions,
  campaignSessions,
  campaignAudienceRecords,
  campaignAudienceFields,
  campaignAudienceLookupLog,
  campaignFlowNodes,
  webhookDeliveries,
  orgMembers,
} from "@/lib/db/schema";
import { mergeExportable } from "@/lib/campaign-engine/conversion";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and, desc, count, sql } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "summary";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const offset = (page - 1) * limit;

    if (view === "summary") {
      const [[{ totalSessions }], [{ totalConversions }]] = await Promise.all([
        db.select({ totalSessions: count() }).from(campaignSessions).where(eq(campaignSessions.campaignId, campaign.id)),
        db.select({ totalConversions: count() }).from(campaignConversions).where(eq(campaignConversions.campaignId, campaign.id)),
      ]);

      // Trigger type breakdown
      const conversions = await db.query.campaignConversions.findMany({
        where: eq(campaignConversions.campaignId, campaign.id),
        columns: { triggerType: true },
      });
      const byTrigger: Record<string, number> = {};
      for (const c of conversions) {
        byTrigger[c.triggerType] = (byTrigger[c.triggerType] ?? 0) + 1;
      }

      return NextResponse.json({
        totalSessions,
        totalConversions,
        conversionRate: totalSessions > 0 ? (totalConversions / totalSessions) : 0,
        byTrigger,
      });
    }

    if (view === "conversions") {
      const [rows, [{ total }]] = await Promise.all([
        db.query.campaignConversions.findMany({
          where: eq(campaignConversions.campaignId, campaign.id),
          orderBy: [desc(campaignConversions.convertedAt)],
          limit,
          offset,
          with: { session: { columns: { id: true } } },
        }),
        db.select({ total: count() }).from(campaignConversions).where(eq(campaignConversions.campaignId, campaign.id)),
      ]);
      return NextResponse.json({ conversions: rows, total, page, limit });
    }

    if (view === "audience") {
      const [rows, [{ total }]] = await Promise.all([
        db.query.campaignAudienceRecords.findMany({
          where: eq(campaignAudienceRecords.campaignId, campaign.id),
          orderBy: [desc(campaignAudienceRecords.createdAt)],
          limit,
          offset,
          columns: { campaignId: false },
        }),
        db.select({ total: count() }).from(campaignAudienceRecords).where(eq(campaignAudienceRecords.campaignId, campaign.id)),
      ]);
      return NextResponse.json({ records: rows, total, page, limit });
    }

    if (view === "lookup-log") {
      const outcome = url.searchParams.get("outcome");
      const where = outcome
        ? and(eq(campaignAudienceLookupLog.campaignId, campaign.id), eq(campaignAudienceLookupLog.outcome, outcome))
        : eq(campaignAudienceLookupLog.campaignId, campaign.id);

      const [rows, [{ total }]] = await Promise.all([
        db.query.campaignAudienceLookupLog.findMany({
          where,
          orderBy: [desc(campaignAudienceLookupLog.attemptedAt)],
          limit,
          offset,
          columns: { campaignId: false },
        }),
        db.select({ total: count() }).from(campaignAudienceLookupLog).where(where),
      ]);
      return NextResponse.json({ entries: rows, total, page, limit });
    }

    if (view === "deliveries") {
      // Fetch conversion IDs for this campaign, then deliveries
      const conversionIds = await db
        .select({ id: campaignConversions.id })
        .from(campaignConversions)
        .where(eq(campaignConversions.campaignId, campaign.id));

      const ids = conversionIds.map((c) => c.id);

      if (ids.length === 0) {
        return NextResponse.json({ deliveries: [], page, limit });
      }

      const { inArray } = await import("drizzle-orm");
      const rows = await db.query.webhookDeliveries.findMany({
        where: inArray(webhookDeliveries.conversionId, ids),
        orderBy: [desc(webhookDeliveries.createdAt)],
        limit,
        offset,
        with: { conversion: { columns: { id: true, triggerType: true, convertedAt: true } } },
      });
      return NextResponse.json({ deliveries: rows, page, limit });
    }

    if (view === "funnel") {
      // Count sessions total, then group by the node they ended on
      const [[{ totalSessions }]] = await Promise.all([
        db.select({ totalSessions: count() }).from(campaignSessions).where(eq(campaignSessions.campaignId, campaign.id)),
      ]);

      // Sessions grouped by current node
      const sessionsByNode = await db
        .select({
          nodeId: campaignSessions.currentNodeId,
          cnt: count(),
        })
        .from(campaignSessions)
        .where(eq(campaignSessions.campaignId, campaign.id))
        .groupBy(campaignSessions.currentNodeId);

      // Get ordered flow nodes (page type only) for this campaign
      const nodes = await db.query.campaignFlowNodes.findMany({
        where: and(eq(campaignFlowNodes.campaignId, campaign.id), eq(campaignFlowNodes.type, "page")),
        with: { page: { columns: { title: true, path: true, isEntry: true, position: true } } },
        orderBy: (n, { asc }) => [asc(n.canvasY)],
      });

      // Converted sessions
      const [[{ converted }]] = await Promise.all([
        db.select({ converted: count() }).from(campaignSessions).where(and(eq(campaignSessions.campaignId, campaign.id), sql`${campaignSessions.convertedAt} is not null`)),
      ]);

      const nodeMap = Object.fromEntries(sessionsByNode.map((r) => [r.nodeId ?? "null", Number(r.cnt)]));

      const steps = nodes.map((n) => ({
        nodeId: n.id,
        label: n.page?.title ?? n.label ?? "Unknown",
        path: n.page?.path ?? null,
        sessions: nodeMap[n.id] ?? 0,
        pct: totalSessions > 0 ? Math.round(((nodeMap[n.id] ?? 0) / totalSessions) * 100) : 0,
      }));

      return NextResponse.json({
        totalSessions,
        converted,
        conversionRate: totalSessions > 0 ? Math.round((converted / totalSessions) * 100) : 0,
        steps,
      });
    }

    if (view === "timeseries") {
      // Conversions per day for last 30 days
      const days = 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const rows = await db
        .select({
          day: sql<string>`date_trunc('day', ${campaignConversions.convertedAt})::date::text`,
          cnt: count(),
        })
        .from(campaignConversions)
        .where(and(eq(campaignConversions.campaignId, campaign.id), sql`${campaignConversions.convertedAt} >= ${since.toISOString()}`))
        .groupBy(sql`date_trunc('day', ${campaignConversions.convertedAt})`)
        .orderBy(sql`date_trunc('day', ${campaignConversions.convertedAt})`);

      return NextResponse.json({ days: rows.map((r) => ({ date: r.day, count: Number(r.cnt) })) });
    }

    if (view === "export") {
      // CSV export of all conversions, enriched with the reached goal and the
      // linked audience record (flow-set fields + tags).
      const rows = await db.query.campaignConversions.findMany({
        where: eq(campaignConversions.campaignId, campaign.id),
        orderBy: [desc(campaignConversions.convertedAt)],
        with: { audienceRecord: { columns: { fields: true } } },
      });

      const headers = [
        "id",
        "triggerType",
        "goalKey",
        "goalLabel",
        "triggerPageId",
        "triggerElementId",
        "convertedAt",
        "ipAddress",
        "tags",
        "data",
      ];
      const csvRows = rows.map((r) => {
        const { fields, tags } = mergeExportable(
          r.payload as Record<string, unknown>,
          (r.audienceRecord?.fields as Record<string, unknown> | undefined) ?? null
        );
        return [
          r.id,
          r.triggerType,
          r.goalKey ?? "",
          r.goalLabel ?? "",
          r.triggerPageId ?? "",
          r.triggerElementId ?? "",
          r.convertedAt.toISOString(),
          r.ipAddress,
          tags.join("|"),
          JSON.stringify(fields),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",");
      });

      const csv = [headers.join(","), ...csvRows].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="conversions-${slug}.csv"`,
        },
      });
    }

    if (view === "audience-export") {
      // CSV export of the full enriched audience dataset (all records + fields).
      const fieldDefs = await db.query.campaignAudienceFields.findMany({
        where: eq(campaignAudienceFields.campaignId, campaign.id),
        orderBy: [campaignAudienceFields.position],
        columns: { key: true },
      });
      const records = await db.query.campaignAudienceRecords.findMany({
        where: eq(campaignAudienceRecords.campaignId, campaign.id),
        orderBy: [desc(campaignAudienceRecords.createdAt)],
      });

      const fieldKeys = fieldDefs.map((f) => f.key);
      const headers = ["lookupKey", "name", "email", "tags", ...fieldKeys];
      const csvRows = records.map((r) => {
        const fields = (r.fields as Record<string, unknown>) ?? {};
        const rawTags = fields["_tags"];
        const tags = Array.isArray(rawTags) ? rawTags.join("|") : "";
        return [
          r.lookupKey,
          r.name ?? "",
          r.email ?? "",
          tags,
          ...fieldKeys.map((k) => (fields[k] === undefined || fields[k] === null ? "" : String(fields[k]))),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",");
      });

      const csv = [headers.join(","), ...csvRows].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audience-${slug}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
