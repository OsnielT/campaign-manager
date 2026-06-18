import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerifications } from "@/lib/db/schema";
import { hashToken } from "@/lib/auth/tokens";
import { errorResponse, badRequest } from "@/lib/errors";
import { eq, and, isNull, gt } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body ?? {};

    if (!token) {
      return NextResponse.json(errorResponse(badRequest("token is required")), {
        status: 400,
      });
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    const verification = await db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.tokenHash, tokenHash),
        isNull(emailVerifications.usedAt),
        gt(emailVerifications.expiresAt, now)
      ),
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Invalid or expired verification token", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerifications)
        .set({ usedAt: now })
        .where(eq(emailVerifications.id, verification.id));

      await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, verification.userId));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json(errorResponse(err), { status: 500 });
  }
}
