import { db } from "@/lib/db";
import {
  campaigns,
  campaignPages,
  campaignPageCompositions,
  campaignFlowNodes,
  campaignFlowEdges,
  campaignAudienceFields,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface InstantiateOptions {
  /** The campaign (or template) to copy from — must belong to the same org */
  sourceCampaignId: string;
  orgId: string;
  userId: string;
  name: string;
  slug: string;
  /** When true the result is marked as a template itself */
  isTemplate?: boolean;
}

/**
 * Deep-copies a campaign (or template) into a new independent campaign record.
 * Copies: pages + compositions, flow nodes + edges (with ID remapping), audience field definitions.
 * Does NOT copy audience records.
 */
export async function instantiateCampaign(opts: InstantiateOptions) {
  const { sourceCampaignId, orgId, userId, name, slug, isTemplate = false } = opts;

  const source = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, sourceCampaignId), eq(campaigns.orgId, orgId)),
    with: {
      pages: { with: { composition: true } },
      flowNodes: true,
      flowEdges: true,
      audienceFields: true,
    },
  });

  if (!source) throw new Error("Source campaign not found");

  return db.transaction(async (tx) => {
    const [newCampaign] = await tx
      .insert(campaigns)
      .values({
        orgId,
        name,
        slug,
        status: "draft",
        theme: source.theme ?? undefined,
        isTemplate,
        createdBy: userId,
      })
      .returning();

    // Pages + compositions
    const pageIdMap: Record<string, string> = {};
    for (const page of source.pages) {
      const [clonedPage] = await tx
        .insert(campaignPages)
        .values({
          campaignId: newCampaign.id,
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

    // Flow nodes
    const nodeIdMap: Record<string, string> = {};
    for (const node of source.flowNodes) {
      const [clonedNode] = await tx
        .insert(campaignFlowNodes)
        .values({
          campaignId: newCampaign.id,
          type: node.type,
          pageId: node.pageId ? (pageIdMap[node.pageId] ?? null) : null,
          label: node.label ?? undefined,
          canvasX: node.canvasX,
          canvasY: node.canvasY,
        })
        .returning();
      nodeIdMap[node.id] = clonedNode.id;
    }

    // Flow edges
    for (const edge of source.flowEdges) {
      const newSource = nodeIdMap[edge.sourceNodeId];
      const newTarget = nodeIdMap[edge.targetNodeId];
      if (!newSource || !newTarget) continue;
      await tx.insert(campaignFlowEdges).values({
        campaignId: newCampaign.id,
        sourceNodeId: newSource,
        targetNodeId: newTarget,
        ruleGroup: edge.ruleGroup ?? undefined,
        ruleOrder: edge.ruleOrder,
      });
    }

    // Audience field definitions (not records)
    for (const field of source.audienceFields) {
      await tx.insert(campaignAudienceFields).values({
        campaignId: newCampaign.id,
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        position: field.position,
        onActivation: field.onActivation ?? undefined,
        generator: field.generator ?? undefined,
      });
    }

    return newCampaign;
  });
}
