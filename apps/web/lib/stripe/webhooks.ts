import Stripe from "stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { planFromPriceId } from "./client";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const priceId = sub.items.data[0]?.price.id;
      const plan = priceId ? planFromPriceId(priceId) : "free";

      await db
        .update(organizations)
        .set({ plan })
        .where(eq(organizations.stripeCustomerId, customerId));
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await db
        .update(organizations)
        .set({ plan: "free" })
        .where(eq(organizations.stripeCustomerId, customerId));
      break;
    }

    case "invoice.payment_failed":
      // Future: send payment-failed email notification
      break;

    default:
      break;
  }
}
