import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, orgMembers, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { stripe, stripeEnabled, PRICE_IDS } from "@/lib/stripe/client";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ orgId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const { userId } = await getRequestUser(req);;

  const [membership, org, user] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true, name: true },
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

    // Ensure Stripe customer exists, seeded with the owner's identity so
    // Checkout prefills their email/name.
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: user?.name ?? org.name,
        metadata: { orgId, userId },
      });
      customerId = customer.id;
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, orgId));
    } else if (user?.email) {
      // Keep an existing customer's email in sync so prefill stays correct.
      await stripe.customers.update(customerId, { email: user.email, name: user.name ?? undefined });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${appUrl}/org/settings?upgraded=1`,
      cancel_url: `${appUrl}/org/settings`,
      client_reference_id: userId,
      // Let Stripe save/update the customer's name from the payment form.
      customer_update: { name: "auto" },
      allow_promotion_codes: true,
      metadata: { orgId, userId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
