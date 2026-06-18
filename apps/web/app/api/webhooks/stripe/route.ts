import { NextRequest, NextResponse } from "next/server";
import { stripe, stripeEnabled } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe/webhooks";

// Raw body is required for Stripe signature verification
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  if (!stripeEnabled) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
