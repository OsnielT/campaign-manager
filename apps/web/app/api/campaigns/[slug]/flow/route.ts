import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignFlowNodes, campaignFlowEdges, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

export async function GET(
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
      columns: { id: true },
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  const [nodes, edges] = await Promise.all([
    db.query.campaignFlowNodes.findMany({
      where: eq(campaignFlowNodes.campaignId, campaign.id),
      with: { page: { columns: { id: true, title: true, path: true, type: true, isEntry: true } } },
    }),
    db.query.campaignFlowEdges.findMany({
      where: eq(campaignFlowEdges.campaignId, campaign.id),
      orderBy: (e, { asc }) => [asc(e.ruleOrder)],
    }),
  ]);

  return NextResponse.json({ nodes, edges });
}

export async function PUT(
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
      columns: { id: true },
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json();
    const { nodes = [], edges = [] } = body ?? {};

    await db.transaction(async (tx) => {
      // Replace all nodes and edges for this campaign
      await tx
        .delete(campaignFlowEdges)
        .where(eq(campaignFlowEdges.campaignId, campaign.id));
      await tx
        .delete(campaignFlowNodes)
        .where(eq(campaignFlowNodes.campaignId, campaign.id));

      if (nodes.length > 0) {
        await tx.insert(campaignFlowNodes).values(
          nodes.map((n: Record<string, unknown>) => ({
            id: n.id as string,
            campaignId: campaign.id,
            type: n.type as string,
            pageId: (n.pageId as string | null) ?? null,
            label: (n.label as string | null) ?? null,
            goalKey: (n.goalKey as string | null) ?? null,
            goalLabel: (n.goalLabel as string | null) ?? null,
            goalValue: (n.goalValue as number | null) ?? null,
            actions: (n.actions as unknown) ?? null,
            config: (n.config as unknown) ?? null,
            canvasX: n.canvasX as number,
            canvasY: n.canvasY as number,
          }))
        );
      }

      if (edges.length > 0) {
        await tx.insert(campaignFlowEdges).values(
          edges.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            campaignId: campaign.id,
            sourceNodeId: e.sourceNodeId as string,
            targetNodeId: e.targetNodeId as string,
            ruleGroup: (e.ruleGroup as Record<string, unknown> | null) ?? null,
            ruleOrder: e.ruleOrder as number,
            weight: (e.weight as number | null) ?? null,
          }))
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
