import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailBroadcasts } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { resolveBroadcast } from "@/lib/email/broadcast-access";
import { getRequestUser } from "@/lib/auth/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { userId, orgId } = await getRequestUser(req);
  const { membership, broadcast } = await resolveBroadcast(slug, id, userId, orgId!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });
  return NextResponse.json({ broadcast });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { userId, orgId } = await getRequestUser(req);
  const { membership, broadcast } = await resolveBroadcast(slug, id, userId, orgId!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });

  try {
    requireRole(membership, "editor");
    const body = await req.json();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string") set.name = body.name;
    if (typeof body.subject === "string") set.subject = body.subject;
    if (typeof body.preheader === "string") set.preheader = body.preheader;
    if (typeof body.fromName === "string" || body.fromName === null) set.fromName = body.fromName;
    if (body.designJson && typeof body.designJson === "object") set.designJson = body.designJson;
    if (body.themeOverride === null || (body.themeOverride && typeof body.themeOverride === "object")) set.themeOverride = body.themeOverride;
    if (body.segmentFilter === null || (body.segmentFilter && typeof body.segmentFilter === "object")) set.segmentFilter = body.segmentFilter;
    if (body.scheduledAt === null) set.scheduledAt = null;
    else if (typeof body.scheduledAt === "string") set.scheduledAt = new Date(body.scheduledAt);

    const [updated] = await db.update(emailBroadcasts).set(set).where(eq(emailBroadcasts.id, id)).returning();
    return NextResponse.json({ broadcast: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { userId, orgId } = await getRequestUser(req);
  const { membership, broadcast } = await resolveBroadcast(slug, id, userId, orgId!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });
  try {
    requireRole(membership, "editor");
    await db.delete(emailBroadcasts).where(eq(emailBroadcasts.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
