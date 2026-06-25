import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, statusFor } from "@/lib/errors";
import { getRequestUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Persist per-user UI prefs. CSRF is enforced by middleware for mutating calls.
export async function PATCH(req: NextRequest) {
  const { userId } = await getRequestUser(req);

  try {
    const body = await req.json().catch(() => ({}));
    const dashboard = body?.dashboard;
    if (dashboard === undefined) return NextResponse.json({ ok: true });

    // Merge into existing prefs so we don't clobber unrelated keys.
    const existing = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { dashboardPrefs: true } });
    const prev = (existing?.dashboardPrefs as Record<string, unknown> | null) ?? {};
    const next = { ...prev, dashboard };

    await db.update(users).set({ dashboardPrefs: next }).where(eq(users.id, userId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
