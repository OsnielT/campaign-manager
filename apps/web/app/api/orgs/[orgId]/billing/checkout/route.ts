import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { stripe, stripeEnabled, PRICE_IDS } from "@/lib/stripe/client";

type Params = { params: Promise<{ orgId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const [membership, org] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!org) return NextResponse.json(errorResponse(notFound("Org")), { status: 404 });
  if (!stripeEnabled) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  try {
    requireRole(membership, "owner");

    const { plan } = (await req.json()) as { plan?: string };
    if (!plan || !(plan in PRICE_IDS)) {
      return NextResponse.json(errorResponse(badRequest("Invalid plan")), { status: 400 });
    }
    if (!PRICE_IDS[plan]) {
      // Plan is valid but its Stripe Price ID env var is unset — a deploy/config
      // problem, not a bad request. Surface it distinctly so it's obvious.
      console.error(`[billing] Missing Stripe price ID for plan "${plan}" (set STRIPE_PRICE_ID_${plan.toUpperCase()}).`);
      return NextResponse.json(
        { error: `The ${plan} plan is not configured for billing yet.` },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Ensure Stripe customer exists
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { orgId },
      });
      customerId = customer.id;
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, orgId));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${appUrl}/org/settings?upgraded=1`,
      cancel_url: `${appUrl}/org/settings`,
      metadata: { orgId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
