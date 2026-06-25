import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizations, orgMembers } from "@/lib/db/schema";
import { errorResponse, statusFor } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/export — download a JSON copy of the caller's personal data.
 * Covers account holder data only; audience/conversion data is per-campaign
 * and exportable via /api/campaigns/[slug]/conversions.
 */
export async function GET(req: NextRequest) {
  const { userId } = await getRequestUser(req);

  try {
    const [user, memberships] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          email: true,
          name: true,
          emailVerifiedAt: true,
          termsAcceptedAt: true,
          createdAt: true,
        },
      }),
      db.query.orgMembers.findMany({
        where: eq(orgMembers.userId, userId),
        with: {
          org: {
            columns: { id: true, name: true, slug: true, plan: true, createdAt: true },
          },
        },
      }),
    ]);

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payload = {
      exportedAt: new Date().toISOString(),
      account: user,
      organizations: memberships.map((m) => ({
        role: m.role,
        joinedAt: m.joinedAt,
        org: m.org,
      })),
      note: "Audience and conversion data is exportable per-campaign via the Conversions tab in your dashboard.",
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="stemflow-export-${userId}.json"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/me/export]", err);
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
