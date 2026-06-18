import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

async function resolve(orgId: string, userId: string, slug: string) {
  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      with: { pages: { orderBy: (p, { asc }) => [asc(p.position)] } },
    }),
  ]);
  return { membership, campaign };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  return NextResponse.json({ campaign });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json();
    const allowed = ["name", "scheduledAt", "expiresAt", "expiryRedirectUrl", "expiryPageTree", "theme"] as const;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const [updated] = await db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, campaign.id))
      .returning();

    return NextResponse.json({ campaign: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "owner");
    await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
