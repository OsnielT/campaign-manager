import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { ResetPasswordTemplate } from "@/lib/email/templates/reset-password";
import { rateLimiters, getIp, checkRateLimit } from "@/lib/rate-limit";
import { renderAsync } from "@react-email/components";
import { eq } from "drizzle-orm";
import React from "react";

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(rateLimiters.reset(), ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const { email } = body ?? {};

  // Always return 200 to prevent email enumeration
  if (!email) return NextResponse.json({ ok: true });

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
      columns: { id: true, name: true, email: true },
    });

    if (!user) return NextResponse.json({ ok: true });

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    const html = await renderAsync(
      React.createElement(ResetPasswordTemplate, { resetUrl, userName: user.name })
    );

    await sendEmail({ to: user.email, subject: "Reset your Primitive password", html });
  } catch (err) {
    console.error("[forgot-password]", err);
    // Still return 200 to prevent enumeration
  }

  return NextResponse.json({ ok: true });
}
