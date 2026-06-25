import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { stripe, stripeEnabled } from "@/lib/stripe/client";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ orgId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const { userId } = await getRequestUser(req);;

  const [membership, org] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, stripeCustomerId: true },
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!org) return NextResponse.json(errorResponse(notFound("Org")), { status: 404 });
  if (!stripeEnabled) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  try {
    requireRole(membership, "owner");

    if (!org.stripeCustomerId) {
      return NextResponse.json(errorResponse(badRequest("No billing account found")), { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl}/org/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
