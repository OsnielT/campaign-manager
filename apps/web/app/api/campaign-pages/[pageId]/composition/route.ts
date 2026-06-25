import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignPageCompositions, campaignPages, campaigns, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

async function resolvePageAccess(pageId: string, userId: string) {
  const page = await db.query.campaignPages.findFirst({
    where: eq(campaignPages.id, pageId),
    with: { campaign: { columns: { id: true, orgId: true } } },
  });
  if (!page) return { page: null, membership: null };

  const membership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, page.campaign.orgId),
      eq(orgMembers.userId, userId)
    ),
  });
  return { page, membership };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const { page, membership } = await resolvePageAccess(pageId, userId);
  if (!page) return NextResponse.json(errorResponse(notFound("Page")), { status: 404 });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  const composition = await db.query.campaignPageCompositions.findFirst({
    where: eq(campaignPageCompositions.campaignPageId, pageId),
  });

  return NextResponse.json({
    pageId,
    treeJson: composition?.treeJson ?? null,
    schemaVersion: composition?.schemaVersion ?? 1,
    updatedAt: composition?.updatedAt ?? null,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const { page, membership } = await resolvePageAccess(pageId, userId);
  if (!page) return NextResponse.json(errorResponse(notFound("Page")), { status: 404 });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "editor");

    const body = await req.json();
    const { treeJson } = body ?? {};

    if (treeJson === undefined) {
      return NextResponse.json({ error: "treeJson is required" }, { status: 400 });
    }

    await db
      .insert(campaignPageCompositions)
      .values({
        campaignPageId: pageId,
        treeJson,
        schemaVersion: 2, // v2 = Puck format
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: campaignPageCompositions.campaignPageId,
        set: { treeJson, updatedAt: new Date() },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
