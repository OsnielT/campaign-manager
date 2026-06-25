import { NextRequest, NextResponse } from "next/server";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { resolveBroadcast } from "@/lib/email/broadcast-access";
import { countForSegment } from "@/lib/email/broadcast";
import type { RuleGroup } from "@/lib/campaign-engine/branch";
import { getRequestUser } from "@/lib/auth/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { userId, orgId } = await getRequestUser(req);
  const { membership, campaign, broadcast } = await resolveBroadcast(slug, id, userId, orgId!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast || !campaign) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const segment = (body.segmentFilter ?? broadcast.segmentFilter ?? null) as RuleGroup | null;
    const count = await countForSegment(campaign.id, segment);
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
