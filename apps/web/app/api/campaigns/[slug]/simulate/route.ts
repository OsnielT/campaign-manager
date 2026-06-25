import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignFlowNodes, campaignFlowEdges, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import {
  simulateFlow,
  validateFlow,
  type SimNode,
  type SimEdge,
} from "@/lib/campaign-engine/simulate";
import type { RuleGroup } from "@/lib/campaign-engine/branch";
import { parseActions } from "@/lib/campaign-engine/actions";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string }> };

/**
 * Dry-run the flow with sample inputs and return the visited path, fired
 * actions, resulting fields, reached goal, plus static validation issues.
 * Reads the saved flow; performs no writes.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

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

    const body = (await req.json().catch(() => ({}))) ?? {};
    const input = {
      form: (body.form as Record<string, unknown>) ?? {},
      url: (body.url as Record<string, string>) ?? {},
      record: (body.record as Record<string, unknown>) ?? {},
      context: (body.context as Record<string, unknown>) ?? {},
      // Optional clock + A/B seed overrides for reproducible what-if runs.
      now: typeof body.now === "number" ? body.now : Date.now(),
      sessionStart: typeof body.sessionStart === "number" ? body.sessionStart : undefined,
      seed: typeof body.seed === "string" && body.seed ? body.seed : undefined,
    };

    const [nodeRows, edgeRows] = await Promise.all([
      db.query.campaignFlowNodes.findMany({
        where: eq(campaignFlowNodes.campaignId, campaign.id),
        with: { page: { columns: { title: true } } },
      }),
      db.query.campaignFlowEdges.findMany({
        where: eq(campaignFlowEdges.campaignId, campaign.id),
      }),
    ]);

    const nodes: SimNode[] = nodeRows.map((n) => ({
      id: n.id,
      type: n.type as SimNode["type"],
      pageId: n.pageId,
      label: n.label ?? (n.page as { title?: string } | null)?.title ?? null,
      goalKey: n.goalKey,
      goalLabel: n.goalLabel,
      actions: parseActions(n.actions),
      config: (n.config as { mode?: string } | null) ?? null,
    }));
    const edges: SimEdge[] = edgeRows.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      ruleGroup: (e.ruleGroup as RuleGroup | null) ?? null,
      ruleOrder: e.ruleOrder,
      weight: e.weight,
    }));

    const result = simulateFlow(nodes, edges, input);
    const issues = validateFlow(nodes, edges);

    return NextResponse.json({ result, issues });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
