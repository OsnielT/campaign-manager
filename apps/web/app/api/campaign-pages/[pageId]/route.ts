import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignPages, campaignFlowNodes, campaigns, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ pageId: string }> };

async function resolvePage(pageId: string, orgId: string, userId: string) {
  const page = await db.query.campaignPages.findFirst({
    where: eq(campaignPages.id, pageId),
    with: { campaign: { columns: { id: true, orgId: true, slug: true } } },
  });
  if (!page || page.campaign.orgId !== orgId) return { page: null, membership: null };

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  return { page, membership };
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { pageId } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const { page, membership } = await resolvePage(pageId, orgId, userId);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!page) return NextResponse.json(errorResponse(notFound("Page")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json() as Partial<typeof campaignPages.$inferInsert>;
    const updates: Partial<typeof campaignPages.$inferInsert> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.type !== undefined) updates.type = body.type;
    if (body.path !== undefined) updates.path = body.path;
    if (body.isEntry !== undefined) updates.isEntry = body.isEntry;
    if (body.isConversionPage !== undefined) updates.isConversionPage = body.isConversionPage;
    if (body.position !== undefined) updates.position = body.position;
    if ("metaTitle" in body) updates.metaTitle = (body as Record<string, unknown>).metaTitle as string | null;
    if ("metaDescription" in body) updates.metaDescription = (body as Record<string, unknown>).metaDescription as string | null;

    const [updated] = await db
      .update(campaignPages)
      .set(updates)
      .where(eq(campaignPages.id, pageId))
      .returning();

    return NextResponse.json({ page: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { pageId } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const { page, membership } = await resolvePage(pageId, orgId, userId);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!page) return NextResponse.json(errorResponse(notFound("Page")), { status: 404 });

  try {
    requireRole(membership, "editor");

    if (page.isEntry) {
      return NextResponse.json(
        errorResponse({ message: "Cannot delete the entry page", status: 400, code: "CANNOT_DELETE_ENTRY" }),
        { status: 400 }
      );
    }

    // Remove flow nodes referencing this page first (edges cascade from nodes)
    await db.delete(campaignFlowNodes).where(eq(campaignFlowNodes.pageId, pageId));
    await db.delete(campaignPages).where(eq(campaignPages.id, pageId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
