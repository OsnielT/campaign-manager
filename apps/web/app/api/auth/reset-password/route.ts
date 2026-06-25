import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { getSession } from "@/lib/auth/session";
import { errorResponse, badRequest } from "@/lib/errors";
import { eq, and, isNull, gt } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body ?? {};

    if (!token || !password) {
      return NextResponse.json(
        errorResponse(badRequest("token and password are required")),
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        errorResponse(badRequest("Password must be at least 8 characters")),
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now)
      ),
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, resetToken.id));

      await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, resetToken.userId));
    });

    // Invalidate current session
    const session = await getSession();
    session.destroy();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(errorResponse(err), { status: 500 });
  }
}
