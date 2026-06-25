import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizations, orgMembers, mediaAssets } from "@/lib/db/schema";
import { errorResponse, statusFor } from "@/lib/errors";
import { eq, and, count } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET, r2Enabled } from "@/lib/r2";
import { stripe, stripeEnabled } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/me — permanently delete the calling user's account.
 *
 * Deletes orgs the user solely owns (cancels Stripe, purges R2, cascade-deletes),
 * drops memberships in shared orgs, then deletes the user row and session.
 */
export async function DELETE(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Find all orgs this user belongs to
    const memberships = await db.query.orgMembers.findMany({
      where: eq(orgMembers.userId, userId),
      with: { org: { columns: { id: true, stripeSubscriptionId: true } } },
    });

    for (const m of memberships) {
      if (m.role !== "owner") continue;

      // Check whether there are other owners in this org
      const [{ value: ownerCount }] = await db
        .select({ value: count() })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, m.orgId), eq(orgMembers.role, "owner")));

      if (Number(ownerCount) > 1) continue; // shared org with multiple owners — leave it

      const orgId = m.orgId;

      // Cancel Stripe subscription
      if (stripeEnabled && m.org?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(m.org.stripeSubscriptionId);
        } catch {
          // already cancelled — continue
        }
      }

      // Purge R2 media
      if (r2Enabled) {
        const assets = await db.query.mediaAssets.findMany({
          where: eq(mediaAssets.orgId, orgId),
          columns: { r2Key: true },
        });
        if (assets.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < assets.length; i += 1000) {
            chunks.push(assets.slice(i, i + 1000).map((a) => a.r2Key));
          }
          await Promise.all(
            chunks.map((keys) =>
              r2.send(
                new DeleteObjectsCommand({
                  Bucket: R2_BUCKET,
                  Delete: { Objects: keys.map((Key) => ({ Key })) },
                })
              )
            )
          );
        }
      }

      // Cascade-delete the org (campaigns, audience, sessions, etc.)
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }

    // Delete the user row (cascades tokens, memberships in remaining orgs)
    await db.delete(users).where(eq(users.id, userId));

    // Destroy session
    const session = await getSession();
    session.destroy();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/me]", err);
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
