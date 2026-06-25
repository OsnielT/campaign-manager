import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaignPages,
  campaignPageCompositions,
  campaignFlowNodes,
  orgMembers,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and, count } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ pageId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { pageId } = await params;
  const { userId, orgId } = await getRequestUser(req);

  const source = await db.query.campaignPages.findFirst({
    where: eq(campaignPages.id, pageId),
    with: {
      campaign: { columns: { id: true, orgId: true } },
      composition: { columns: { treeJson: true, schemaVersion: true } },
    },
  });

  if (!source || source.campaign.orgId !== orgId) {
    return NextResponse.json(errorResponse(notFound("Page")), { status: 404 });
  }

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "editor");

    const [{ total: position }] = await db
      .select({ total: count() })
      .from(campaignPages)
      .where(eq(campaignPages.campaignId, source.campaignId));

    // Generate a unique path by appending -copy, -copy-2, etc.
    const basePath = source.path.replace(/-copy(-\d+)?$/, "");
    const existingPaths = new Set(
      (
        await db.query.campaignPages.findMany({
          where: eq(campaignPages.campaignId, source.campaignId),
          columns: { path: true },
        })
      ).map((p) => p.path)
    );
    let candidatePath = `${basePath}-copy`;
    let suffix = 2;
    while (existingPaths.has(candidatePath)) {
      candidatePath = `${basePath}-copy-${suffix++}`;
    }

    const page = await db.transaction(async (tx) => {
      const [pg] = await tx
        .insert(campaignPages)
        .values({
          campaignId: source.campaignId,
          title: `Copy of ${source.title}`,
          type: source.type,
          path: candidatePath,
          isEntry: false,
          isConversionPage: source.isConversionPage,
          position,
        })
        .returning();

      await tx.insert(campaignPageCompositions).values({
        campaignPageId: pg.id,
        treeJson: source.composition?.treeJson ?? { content: [], root: { props: {} }, zones: {} },
        schemaVersion: source.composition?.schemaVersion ?? 2,
      });

      await tx.insert(campaignFlowNodes).values({
        campaignId: source.campaignId,
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
