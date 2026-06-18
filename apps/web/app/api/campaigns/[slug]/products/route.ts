import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignProducts, orgProducts, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "viewer");

    const products = await db.query.campaignProducts.findMany({
      where: eq(campaignProducts.campaignId, campaign.id),
      orderBy: (p, { asc }) => [asc(p.position)],
      with: { orgProduct: true },
    });

    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json() as {
      orgProductId?: string;
      nameOverride?: string;
      descriptionOverride?: string;
      imageUrlOverride?: string;
      metadataOverride?: Record<string, unknown>;
      position?: number;
    };

    if (!body.orgProductId) {
      return NextResponse.json(errorResponse(badRequest("orgProductId required")), { status: 400 });
    }

    // Validate org product belongs to this org
    const orgProduct = await db.query.orgProducts.findFirst({
      where: and(eq(orgProducts.id, body.orgProductId), eq(orgProducts.orgId, orgId)),
    });
    if (!orgProduct) return NextResponse.json(errorResponse(notFound("Product")), { status: 404 });

    // Get next position
    const existing = await db.query.campaignProducts.findMany({
      where: eq(campaignProducts.campaignId, campaign.id),
      columns: { position: true },
      orderBy: (p, { desc: d }) => [d(p.position)],
    });
    const nextPosition = (existing[0]?.position ?? -1) + 1;

    const [cp] = await db
      .insert(campaignProducts)
      .values({
        campaignId: campaign.id,
        orgProductId: body.orgProductId,
        nameOverride: body.nameOverride ?? null,
        descriptionOverride: body.descriptionOverride ?? null,
        imageUrlOverride: body.imageUrlOverride ?? null,
        metadataOverride: body.metadataOverride ?? null,
        position: body.position ?? nextPosition,
      })
      .returning();

    return NextResponse.json({ product: cp }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
