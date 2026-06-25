import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, organizations } from "@/lib/db/schema";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { resolveBroadcast } from "@/lib/email/broadcast-access";
import { resolveBrand, type CampaignTheme } from "@/lib/campaign-engine/theme";
import { renderBroadcastHtml } from "@/lib/email/render-broadcast";
import { applyMergeTags, applyThemeOverride, type EmailDesign } from "@/lib/email/design";
import { getRequestUser } from "@/lib/auth/session";

// Sample values so {{merge}} tags show real-looking text in the preview.
const SAMPLE: Record<string, string> = { name: "Alex", email: "alex@example.com" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { userId, orgId } = await getRequestUser(req);
  const { membership, campaign, broadcast } = await resolveBroadcast(slug, id, userId, orgId!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast || !campaign) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const design = (body.designJson as EmailDesign) ?? (broadcast.designJson as EmailDesign);
    const preheader = typeof body.preheader === "string" ? body.preheader : broadcast.preheader;

    const camp = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaign.id), columns: { theme: true, orgId: true } });
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, camp!.orgId), columns: { branding: true } });
    const override = (body.themeOverride !== undefined ? body.themeOverride : broadcast.themeOverride) as Partial<CampaignTheme> | null;
    const theme = applyThemeOverride(resolveBrand(org?.branding ?? null, camp?.theme ?? null), override);

    const html = applyMergeTags(await renderBroadcastHtml(design, theme, preheader), SAMPLE);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
