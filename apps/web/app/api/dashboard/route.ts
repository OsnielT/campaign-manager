import { NextRequest, NextResponse } from "next/server";
import { getDashboardMetrics, isRange } from "@/lib/dashboard/metrics";
import { errorResponse, statusFor } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.headers.get("x-org-id");
  if (!orgId) return NextResponse.json(errorResponse(new Error("No organization")), { status: 401 });

  try {
    const rangeParam = req.nextUrl.searchParams.get("range");
    const range = isRange(rangeParam) ? rangeParam : "30d";
    const metrics = await getDashboardMetrics(orgId, range);
    return NextResponse.json(metrics);
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
