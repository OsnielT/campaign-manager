import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediaAssets, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, badRequest } from "@/lib/errors";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_SIZE_BYTES,
  r2Key,
  publicUrl,
  createPresignedUploadUrl,
} from "@/lib/r2/upload";
import { r2Enabled } from "@/lib/r2";
import { getRequestUser } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!r2Enabled) return NextResponse.json({ error: "Media storage not configured" }, { status: 503 });

  try {
    requireRole(membership, "editor");

    const body = await req.json() as { filename?: string; contentType?: string; sizeBytes?: number };
    const { filename, contentType, sizeBytes } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(errorResponse(badRequest("filename required")), { status: 400 });
    }
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        errorResponse(badRequest("Unsupported content type")),
        { status: 400 }
      );
    }
    if (!sizeBytes || sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
      return NextResponse.json(
        errorResponse(badRequest("File must be between 1 byte and 10 MB")),
        { status: 400 }
      );
    }

    const assetId = randomUUID();
    const key = r2Key(orgId, assetId, filename);
    const url = publicUrl(key);

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        id: assetId,
        orgId,
        uploadedBy: userId,
        filename,
        contentType,
        sizeBytes,
        r2Key: key,
        publicUrl: url,
      })
      .returning();

    const presignedUrl = await createPresignedUploadUrl(key, contentType, sizeBytes);

    return NextResponse.json({ assetId: asset.id, presignedUrl, publicUrl: url });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function GET(req: NextRequest) {
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "viewer");

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const offset = (page - 1) * limit;

    const assets = await db.query.mediaAssets.findMany({
      where: eq(mediaAssets.orgId, orgId),
      orderBy: [desc(mediaAssets.createdAt)],
      limit,
      offset,
    });

    return NextResponse.json({ assets, page, limit });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
