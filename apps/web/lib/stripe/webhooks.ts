import Stripe from "stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { stripe, planFromPriceId } from "./client";

/**
 * Set an org's plan by Stripe customer id — but ONLY write when it actually
 * changes. Stripe sends a burst of subscription.updated events per upgrade
 * (proration, payment, status flips, …); the `ne(plan)` guard turns those into
 * zero-row no-ops so we don't hammer the DB on every redundant event.
 */
async function setPlanForCustomer(customerId: string | null, plan: string): Promise<void> {
  if (!customerId) return;
  await db
    .update(organizations)
    .set({ plan })
    .where(and(eq(organizations.stripeCustomerId, customerId), ne(organizations.plan, plan)));
}

function planFromSubscription(sub: Stripe.Subscription): string {
  const priceId = sub.items.data[0]?.price.id;
  return priceId ? planFromPriceId(priceId) : "free";
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Fired when a new Checkout subscription completes. This is the event that
    // upgrades a first-time subscriber (subscription.updated only fires on
    // *later* changes, so relying on it alone leaves new buyers on "free").
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      // Prefer the plan we stamped in metadata; only call Stripe if it's absent.
      let plan = session.metadata?.plan ?? null;
      if (!plan && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        plan = planFromSubscription(sub);
      }
      if (plan) await setPlanForCustomer(session.customer as string, plan);
      break;
    }

    // Plan changes after the initial purchase (up/downgrade). `created` is a
    // safety net for subscriptions made outside Checkout; both are idempotent.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await setPlanForCustomer(sub.customer as string, planFromSubscription(sub));
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setPlanForCustomer(sub.customer as string, "free");
      break;
    }

    case "invoice.payment_failed":
      // Future: send payment-failed email notification
      break;

    default:
      // Unhandled event types are a no-op. Narrow the endpoint's event
      // subscription in the Stripe dashboard so these aren't even delivered.
      break;
  }
}
