import Stripe from "stripe";

// Stripe is optional locally — routes that require it check stripeEnabled first
export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

export const stripe = stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion })
  : null as unknown as Stripe;

export const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_ID_PRO!,
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE!,
};

/** Map a Stripe price ID back to a plan name */
export function planFromPriceId(priceId: string): string {
  for (const [plan, id] of Object.entries(PRICE_IDS)) {
    if (id === priceId) return plan;
  }
  return "free";
}
