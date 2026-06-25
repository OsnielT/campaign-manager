import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPages, campaignFlowNodes, campaignPageCompositions, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and, count } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

const PAGE_TYPES = ["landing", "product", "offer", "result", "confirmation"] as const;

type Params = { params: Promise<{ slug: string }> };

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

    const body = await req.json() as {
      title?: string;
      type?: string;
      path?: string;
      isEntry?: boolean;
      isConversionPage?: boolean;
    };

    if (!body.title?.trim()) {
      return NextResponse.json(errorResponse(badRequest("title required")), { status: 400 });
    }
    if (!body.type || !PAGE_TYPES.includes(body.type as typeof PAGE_TYPES[number])) {
      return NextResponse.json(errorResponse(badRequest(`type must be one of: ${PAGE_TYPES.join(", ")}`)), { status: 400 });
    }

    // Auto-generate path from title if not provided
    const path =
      body.path?.trim() ||
      "/" + body.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const [{ total: position }] = await db
      .select({ total: count() })
      .from(campaignPages)
      .where(eq(campaignPages.campaignId, campaign.id));

    const page = await db.transaction(async (tx) => {
      const [pg] = await tx
        .insert(campaignPages)
        .values({
          campaignId: campaign.id,
          title: body.title!.trim(),
          type: body.type!,
          path,
          isEntry: body.isEntry ?? position === 0,
          isConversionPage: body.isConversionPage ?? false,
          position,
        })
        .returning();

      // Create blank composition
      await tx.insert(campaignPageCompositions).values({
        campaignPageId: pg.id,
        treeJson: { content: [], root: { props: {} }, zones: {} },
        schemaVersion: 2,
      });

      // Create flow node
      await tx.insert(campaignFlowNodes).values({
        campaignId: campaign.id,
        type: "page",
        pageId: pg.id,
        label: pg.title,
        canvasX: 200,
        canvasY: position * 160,
      });

      return pg;
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
