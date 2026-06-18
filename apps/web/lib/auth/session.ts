import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export interface SessionData {
  userId: string;
  orgId: string | null;
}

export const sessionOptions: SessionOptions = {
  cookieName: "primitive_session",
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

/** Read session in Server Components and Route Handlers using next/headers cookies */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/** Read session from a Request object (middleware, route handlers without next/headers) */
export async function getSessionFromRequest(
  req: NextRequest,
  res: NextResponse
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

/** Helper to read user identity forwarded by middleware headers */
export function getRequestUser(req: NextRequest): { userId: string; orgId: string | null } {
  const userId = req.headers.get("x-user-id");
  const orgId = req.headers.get("x-org-id");
  if (!userId) throw new Error("No x-user-id header — route not protected by middleware");
  return { userId, orgId };
}
