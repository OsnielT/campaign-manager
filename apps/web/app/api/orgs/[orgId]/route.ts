import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, orgMembers, mediaAssets } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET, r2Enabled } from "@/lib/r2";
import { stripe, stripeEnabled } from "@/lib/stripe/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "owner");

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if ("name" in body) {
      if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
      updates.name = body.name;
    }
    if ("branding" in body) {
      updates.branding = body.branding ?? null;
    }
    if ("legalName" in body) updates.legalName = body.legalName ?? null;
    if ("postalAddress" in body) updates.postalAddress = body.postalAddress ?? null;
    if ("fromName" in body) updates.fromName = body.fromName ?? null;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true },
    });
    if (!org) return NextResponse.json(errorResponse(notFound("Org")), { status: 404 });

    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({ org: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "owner");

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, stripeSubscriptionId: true },
    });
    if (!org) return NextResponse.json(errorResponse(notFound("Org")), { status: 404 });

    // Cancel Stripe subscription if active
    if (stripeEnabled && org.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      } catch {
        // Subscription may already be cancelled; continue with deletion
      }
    }

    // Delete all R2 media objects for this org
    if (r2Enabled) {
      const assets = await db.query.mediaAssets.findMany({
        where: eq(mediaAssets.orgId, orgId),
        columns: { r2Key: true },
      });
      if (assets.length > 0) {
        // R2/S3 DeleteObjects accepts up to 1000 keys per call
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

    // Cascade delete via DB (schema has onDelete: cascade for all child tables)
    await db.delete(organizations).where(eq(organizations.id, orgId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
