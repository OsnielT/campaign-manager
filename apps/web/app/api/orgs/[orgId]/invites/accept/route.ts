import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orgInvites, orgMembers, users } from "@/lib/db/schema";
import { hashToken } from "@/lib/auth/tokens";
import { getSession } from "@/lib/auth/session";
import { errorResponse, badRequest } from "@/lib/errors";
import { eq, and, isNull, gt } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  try {
    const body = await req.json();
    const { token } = body ?? {};
    if (!token) {
      return NextResponse.json(errorResponse(badRequest("token required")), { status: 400 });
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    const invite = await db.query.orgInvites.findFirst({
      where: and(
        eq(orgInvites.orgId, orgId),
        eq(orgInvites.tokenHash, tokenHash),
        isNull(orgInvites.acceptedAt),
        gt(orgInvites.expiresAt, now)
      ),
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite", code: "INVALID_INVITE" },
        { status: 400 }
      );
    }

    const session = await getSession();
    if (!session.userId) {
      // Redirect to signup with invite token in query param — handled client-side
      return NextResponse.json(
        { error: "Not authenticated", redirectTo: `/signup?invite=${token}` },
        { status: 401 }
      );
    }

    // Check if already a member
    const existing = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, session.userId)),
    });

    await db.transaction(async (tx) => {
      await tx
        .update(orgInvites)
        .set({ acceptedAt: now })
        .where(eq(orgInvites.id, invite.id));

      if (!existing) {
        await tx.insert(orgMembers).values({
          orgId,
          userId: session.userId!,
          role: invite.role,
        });
      }
    });

    session.orgId = orgId;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[invite-accept]", err);
    return NextResponse.json(errorResponse(err), { status: 500 });
  }
}
