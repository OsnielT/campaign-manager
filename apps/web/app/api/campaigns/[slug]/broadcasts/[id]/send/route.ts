import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailBroadcasts } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { resolveBroadcast } from "@/lib/email/broadcast-access";
import { sendBroadcast } from "@/lib/email/broadcast";
import { getRequestUser } from "@/lib/auth/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { userId, orgId } = await getRequestUser(req);
  const { membership, broadcast } = await resolveBroadcast(slug, id, userId, orgId!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });

  try {
    requireRole(membership, "editor");
    if (broadcast.status === "sending") {
      return NextResponse.json(errorResponse(badRequest("Broadcast is already sending")), { status: 409 });
    }
    const body = await req.json().catch(() => ({}));
    const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;

    // Schedule for later
    if (scheduledAt && scheduledAt.getTime() > Date.now() + 30_000) {
      const [updated] = await db.update(emailBroadcasts)
        .set({ status: "scheduled", scheduledAt, updatedAt: new Date() })
        .where(eq(emailBroadcasts.id, id))
        .returning();
      return NextResponse.json({ scheduled: true, broadcast: updated });
    }

    // Send now
    const summary = await sendBroadcast(id);
    return NextResponse.json({ sent: true, summary });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
