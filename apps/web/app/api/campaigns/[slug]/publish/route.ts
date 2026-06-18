import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignFlowNodes, campaignFlowEdges, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { validateFlow, type SimNode, type SimEdge } from "@/lib/campaign-engine/simulate";
import type { RuleGroup } from "@/lib/campaign-engine/branch";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true, status: true },
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json().catch(() => ({}));
    const unpublish = body?.unpublish === true;

    if (unpublish) {
      if (campaign.status !== "published") {
        return NextResponse.json(
          errorResponse(badRequest("Campaign is not published")),
          { status: 400 }
        );
      }
      const [updated] = await db
        .update(campaigns)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id))
        .returning();
      return NextResponse.json({ campaign: updated });
    }

    if (!["draft", "scheduled"].includes(campaign.status)) {
      return NextResponse.json(
        errorResponse(badRequest("Campaign cannot be published from its current state")),
        { status: 400 }
      );
    }

    // Pre-publish validation gate: a broken flow must not go live.
    const [nodeRows, edgeRows] = await Promise.all([
      db.query.campaignFlowNodes.findMany({
        where: eq(campaignFlowNodes.campaignId, campaign.id),
      }),
      db.query.campaignFlowEdges.findMany({
        where: eq(campaignFlowEdges.campaignId, campaign.id),
      }),
    ]);
    const nodes: SimNode[] = nodeRows.map((n) => ({
      id: n.id,
      type: n.type as SimNode["type"],
      pageId: n.pageId,
      label: n.label,
      goalKey: n.goalKey,
      goalLabel: n.goalLabel,
      actions: n.actions,
      config: (n.config as { mode?: string } | null) ?? null,
    }));
    const edges: SimEdge[] = edgeRows.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      ruleGroup: (e.ruleGroup as RuleGroup | null) ?? null,
      ruleOrder: e.ruleOrder,
    }));
    const issues = validateFlow(nodes, edges);
    const errors = issues.filter((i) => i.level === "error");
    if (errors.length > 0) {
      return NextResponse.json(
        { ...errorResponse(badRequest("Flow validation failed")), issues },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: "published", scheduledAt: null, updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id))
      .returning();

    return NextResponse.json({ campaign: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
