import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediaAssets, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2/index";

type Params = { params: Promise<{ assetId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { assetId } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, asset] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.mediaAssets.findFirst({
      where: and(eq(mediaAssets.id, assetId), eq(mediaAssets.orgId, orgId)),
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!asset) return NextResponse.json(errorResponse(notFound("Asset")), { status: 404 });

  try {
    requireRole(membership, "editor");

    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: asset.r2Key }));
    await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
