import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignAudienceRecords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

function page(title: string, message: string, ok: boolean): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6f8;color:#1a1a1a"><div style="max-width:440px;margin:14vh auto;padding:32px;background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center"><div style="font-size:32px;margin-bottom:12px">${ok ? "✓" : "⚠️"}</div><h1 style="font-size:19px;margin:0 0 8px">${title}</h1><p style="font-size:14px;line-height:1.5;color:#555;margin:0">${message}</p></div></body></html>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const recordId = req.nextUrl.searchParams.get("u") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";

  if (!recordId || !token || !verifyUnsubscribe(recordId, token)) {
    return page("Invalid unsubscribe link", "This link is invalid or has expired. Please contact the sender to be removed.", false);
  }

  // Test emails carry a "preview" sentinel (not a real audience record / UUID).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId);
  if (!isUuid) {
    return page("Test unsubscribe link", "This was a test email — there's nothing to unsubscribe. Real emails will remove the recipient here.", true);
  }

  const record = await db.query.campaignAudienceRecords.findFirst({
    where: eq(campaignAudienceRecords.id, recordId),
    columns: { id: true, email: true, unsubscribedAt: true },
  });
  if (!record) {
    return page("Already removed", "We couldn't find this subscription — you may already have been removed.", true);
  }

  if (!record.unsubscribedAt) {
    await db.update(campaignAudienceRecords)
      .set({ unsubscribedAt: new Date() })
      .where(eq(campaignAudienceRecords.id, recordId));
  }

  return page("You're unsubscribed", `${record.email ?? "You"} will no longer receive emails from this campaign.`, true);
}
