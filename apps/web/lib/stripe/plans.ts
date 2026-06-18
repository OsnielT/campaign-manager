import { db } from "@/lib/db";
import { campaigns, orgMembers } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { planLimitReached } from "@/lib/errors";

export type Plan = "free" | "pro" | "enterprise";

export const PLAN_LIMITS: Record<Plan, { campaigns: number; members: number }> = {
  free: { campaigns: 3, members: 1 },
  pro: { campaigns: 50, members: 15 },
  enterprise: { campaigns: Infinity, members: Infinity },
};

export async function assertWithinPlan(
  orgId: string,
  orgPlan: string,
  resource: "campaigns" | "members"
): Promise<void> {
  const plan = (orgPlan as Plan) in PLAN_LIMITS ? (orgPlan as Plan) : "free";
  const limit = PLAN_LIMITS[plan][resource];
  if (limit === Infinity) return;

  let current: number;
  if (resource === "campaigns") {
    const [row] = await db
      .select({ total: count() })
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId));
    current = row.total;
  } else {
    const [row] = await db
      .select({ total: count() })
      .from(orgMembers)
      .where(eq(orgMembers.orgId, orgId));
    current = row.total;
  }

  if (current >= limit) throw planLimitReached();
}
