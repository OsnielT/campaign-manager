import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/cron/tick";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) return true;
  // Manual/self-hosted triggers may use the custom header.
  return req.headers.get("x-cron-secret") === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await tick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/tick]", err);
    return NextResponse.json({ error: "Cron tick failed" }, { status: 500 });
  }
}

// Vercel Cron issues GET requests; accept the same authorized handler.
export const GET = POST;
