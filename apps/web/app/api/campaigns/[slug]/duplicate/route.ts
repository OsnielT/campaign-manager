import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignPages,
  campaignPageCompositions,
  campaignFlowNodes,
  campaignFlowEdges,
  campaignAudienceFields,
  orgMembers,
  organizations,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { assertWithinPlan } from "@/lib/stripe/plans";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, campaign, org] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      with: {
        pages: { with: { composition: true } },
        flowNodes: true,
        flowEdges: true,
        audienceFields: true,
      },
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { plan: true },
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");
    await assertWithinPlan(orgId, org?.plan ?? "free", "campaigns");

    // Find a unique slug for the copy
    let copySlug = `${campaign.slug}-copy`;
    let attempts = 0;
    while (true) {
      const exists = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, copySlug)),
        columns: { id: true },
      });
      if (!exists) break;
      attempts++;
      copySlug = `${campaign.slug}-copy-${attempts}`;
    }

    const newCampaign = await db.transaction(async (tx) => {
      // 1. Create the campaign copy (draft, no audience records)
      const [cloned] = await tx
        .insert(campaigns)
        .values({
          orgId,
          name: `${campaign.name} (copy)`,
          slug: copySlug,
          status: "draft",
          theme: campaign.theme ?? undefined,
          createdBy: userId,
        })
        .returning();

      // 2. Clone pages + compositions, building a map of old → new page IDs
      const pageIdMap: Record<string, string> = {};
      for (const page of campaign.pages) {
        const [clonedPage] = await tx
          .insert(campaignPages)
          .values({
            campaignId: cloned.id,
            type: page.type,
            title: page.title,
            path: page.path,
            isEntry: page.isEntry,
            isConversionPage: page.isConversionPage,
            position: page.position,
            metaTitle: page.metaTitle ?? undefined,
            metaDescription: page.metaDescription ?? undefined,
          })
          .returning();
        pageIdMap[page.id] = clonedPage.id;

        if (page.composition) {
          await tx.insert(campaignPageCompositions).values({
            campaignPageId: clonedPage.id,
            treeJson: page.composition.treeJson,
            schemaVersion: page.composition.schemaVersion,
          });
        }
      }

      // 3. Clone flow nodes, building a map of old → new node IDs
      const nodeIdMap: Record<string, string> = {};
      for (const node of campaign.flowNodes) {
        const [clonedNode] = await tx
          .insert(campaignFlowNodes)
          .values({
            campaignId: cloned.id,
            type: node.type,
            pageId: node.pageId ? (pageIdMap[node.pageId] ?? null) : null,
            label: node.label ?? undefined,
            canvasX: node.canvasX,
            canvasY: node.canvasY,
          })
          .returning();
        nodeIdMap[node.id] = clonedNode.id;
      }

      // 4. Clone flow edges
      for (const edge of campaign.flowEdges) {
        const newSource = nodeIdMap[edge.sourceNodeId];
        const newTarget = nodeIdMap[edge.targetNodeId];
        if (!newSource || !newTarget) continue;
        await tx.insert(campaignFlowEdges).values({
          campaignId: cloned.id,
          sourceNodeId: newSource,
          targetNodeId: newTarget,
          ruleGroup: edge.ruleGroup ?? undefined,
          ruleOrder: edge.ruleOrder,
        });
      }

      // 5. Clone audience field definitions (not records)
      for (const field of campaign.audienceFields) {
        await tx.insert(campaignAudienceFields).values({
          campaignId: cloned.id,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          position: field.position,
          onActivation: field.onActivation ?? undefined,
        });
      }

      return cloned;
    });

    return NextResponse.json({ campaign: newCampaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
