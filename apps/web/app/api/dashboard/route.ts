import { NextRequest, NextResponse } from "next/server";
import { getDashboardMetrics, isRange } from "@/lib/dashboard/metrics";
import { errorResponse, statusFor } from "@/lib/errors";
import { getRequestUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { orgId } = await getRequestUser(req);
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
