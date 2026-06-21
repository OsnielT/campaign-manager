import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerifications } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";
import { getSession } from "@/lib/auth/session";
import { generateCsrfToken, setCsrfCookie } from "@/lib/auth/csrf";
import { sendEmail, EMAIL_FROM } from "@/lib/email";
import { VerifyEmailTemplate } from "@/lib/email/templates/verify-email";
import { rateLimiters, getIp, checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, statusFor, badRequest } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { renderAsync } from "@react-email/components";
import React from "react";

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(rateLimiters.signup(), ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, password, name } = body ?? {};

    if (!email || !password || !name) {
      return NextResponse.json(
        errorResponse(badRequest("email, password, and name are required")),
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        errorResponse(badRequest("Password must be at least 8 characters")),
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
    if (existing) {
      return NextResponse.json(
        errorResponse(badRequest("Email already registered", "EMAIL_TAKEN")),
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();
    const devVerifiedAt = process.env.NODE_ENV === "development" ? now : null;
    const [user] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash, name, emailVerifiedAt: devVerifiedAt, termsAcceptedAt: now })
      .returning({ id: users.id, name: users.name });

    if (process.env.NODE_ENV !== "development") {
      // Create verification token
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .insert(emailVerifications)
        .values({ userId: user.id, tokenHash, expiresAt });

      // Send verification email
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const verificationUrl = `${appUrl}/verify-email?token=${rawToken}`;

      const html = await renderAsync(
        React.createElement(VerifyEmailTemplate, {
          verificationUrl,
          userName: user.name,
        })
      );

      await sendEmail({ to: email, subject: "Verify your Stemflow email", html });
    }

    // Set session
    const session = await getSession();
    session.userId = user.id;
    session.orgId = null;
    await session.save();

    // Set CSRF cookie
    const res = NextResponse.json({ ok: true }, { status: 201 });
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    return res;
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
