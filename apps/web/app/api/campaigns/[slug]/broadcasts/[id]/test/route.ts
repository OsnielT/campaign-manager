import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, organizations, users, campaignAudienceRecords } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";
import { resolveBroadcast } from "@/lib/email/broadcast-access";
import { resolveBrand, type CampaignTheme } from "@/lib/campaign-engine/theme";
import { renderBroadcastHtml } from "@/lib/email/render-broadcast";
import { applyMergeTags, applyThemeOverride, mergeValuesFor, type EmailDesign } from "@/lib/email/design";
import { sendEmail, emailConfigured } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const userId = req.headers.get("x-user-id")!;
  const { membership, campaign, broadcast } = await resolveBroadcast(slug, id, userId, req.headers.get("x-org-id")!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!broadcast || !campaign) return NextResponse.json(errorResponse(notFound("Broadcast")), { status: 404 });

  try {
    requireRole(membership, "editor");
    const body = await req.json().catch(() => ({}));
    const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
    const to = typeof body.to === "string" && body.to.includes("@") ? body.to : user?.email;
    if (!to) return NextResponse.json(errorResponse(badRequest("No email address to test-send to")), { status: 400 });

    const camp = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaign.id), columns: { theme: true, orgId: true } });
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, camp!.orgId), columns: { branding: true } });
    const override = (body.themeOverride !== undefined ? body.themeOverride : broadcast.themeOverride) as Partial<CampaignTheme> | null;
    const theme = applyThemeOverride(resolveBrand(org?.branding ?? null, camp?.theme ?? null), override);

    const design = (body.designJson as EmailDesign) ?? (broadcast.designJson as EmailDesign);
    const preheader = typeof body.preheader === "string" ? body.preheader : broadcast.preheader;
    const subject = typeof body.subject === "string" ? body.subject : broadcast.subject;

    // Use the recipient's own audience record (if they're in the audience) so the
    // unsubscribe link in the test is real; otherwise a preview token that the
    // public endpoint resolves to a friendly "already removed" page.
    const audienceRecord = await db.query.campaignAudienceRecords.findFirst({
      where: and(eq(campaignAudienceRecords.campaignId, campaign.id), eq(campaignAudienceRecords.email, to)),
      columns: { id: true },
    });
    const values = mergeValuesFor("there", to, {}, unsubscribeUrl(audienceRecord?.id ?? "preview"));
    const html = applyMergeTags(await renderBroadcastHtml(design, theme, preheader), values);
    await sendEmail({ to, subject: `[Test] ${applyMergeTags(subject, values) || "Your broadcast"}`, html });

    return NextResponse.json({ ok: true, to, configured: emailConfigured() });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
