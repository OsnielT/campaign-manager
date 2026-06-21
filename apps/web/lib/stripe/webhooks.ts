import Stripe from "stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe, planFromPriceId } from "./client";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Fired when a new Checkout subscription completes. This is the event that
    // upgrades a first-time subscriber (subscription.updated only fires on
    // *later* changes, so relying on it alone leaves new buyers on "free").
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const customerId = session.customer as string;
      // Prefer the plan we stamped in metadata; fall back to the price ID.
      let plan = session.metadata?.plan ?? null;
      if (!plan) {
        const subId = session.subscription as string | null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items.data[0]?.price.id;
          plan = priceId ? planFromPriceId(priceId) : "free";
        }
      }
      if (plan && customerId) {
        await db
          .update(organizations)
          .set({ plan })
          .where(eq(organizations.stripeCustomerId, customerId));
      }
      break;
    }

    case "customer.subscription.created":
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
