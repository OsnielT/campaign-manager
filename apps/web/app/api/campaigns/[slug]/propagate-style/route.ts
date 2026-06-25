import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPages, campaignPageCompositions, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { applyStyleToTree, type PuckTreeLike, type StyleScope } from "@/lib/builder/style-propagation";
import { getRequestUser } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    const style = body?.style;
    if (typeof type !== "string" || !type || !style || typeof style !== "object" || Array.isArray(style)) {
      return NextResponse.json(errorResponse(badRequest("type and style are required")), { status: 400 });
    }
    const scope: StyleScope | null =
      body?.scope && typeof body.scope.parentType === "string" && typeof body.scope.slotKey === "string"
        ? { parentType: body.scope.parentType, slotKey: body.scope.slotKey }
        : null;

    const pages = await db.query.campaignPages.findMany({
      where: eq(campaignPages.campaignId, campaign.id),
      columns: { id: true },
      with: { composition: true },
    });

    let components = 0;
    let pagesAffected = 0;

    for (const page of pages) {
      const tree = page.composition?.treeJson as PuckTreeLike | undefined;
      if (!tree) continue;
      const clone = JSON.parse(JSON.stringify(tree)) as PuckTreeLike;
      const n = applyStyleToTree(clone, type, style as Record<string, unknown>, scope);
      if (n > 0) {
        await db
          .update(campaignPageCompositions)
          .set({ treeJson: clone, updatedAt: new Date() })
          .where(eq(campaignPageCompositions.campaignPageId, page.id));
        components += n;
        pagesAffected += 1;
      }
    }

    return NextResponse.json({ ok: true, components, pages: pagesAffected });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
