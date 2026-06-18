import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/cron/tick";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
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
