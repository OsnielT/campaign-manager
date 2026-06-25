import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, orgMembers } from "@/lib/db/schema";
import { verifyPassword, dummyVerify } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { generateCsrfToken, setCsrfCookie } from "@/lib/auth/csrf";
import { rateLimiters, getIp, checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, statusFor, badRequest, unauthorized } from "@/lib/errors";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(rateLimiters.login(), ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        errorResponse(badRequest("email and password are required")),
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    let passwordValid = false;
    if (user) {
      passwordValid = await verifyPassword(password, user.passwordHash);
    } else {
      // Run a comparable bcrypt comparison so timing doesn't reveal whether the
      // email exists (user enumeration defense).
      await dummyVerify(password);
    }

    if (!user || !passwordValid) {
      return NextResponse.json(
        errorResponse(unauthorized("Invalid email or password")),
        { status: 401 }
      );
    }

    if (!user.emailVerifiedAt) {
      if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
          { error: "Email not verified", reason: "unverified" },
          { status: 403 }
        );
      }
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
    }

    // Resolve the user's active org (first org membership found)
    const membership = await db.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, user.id),
    });

    const session = await getSession();
    session.userId = user.id;
    session.orgId = membership?.orgId ?? null;
    await session.save();

    const res = NextResponse.json({ ok: true });
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    return res;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
