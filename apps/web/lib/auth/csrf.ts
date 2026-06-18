import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE = "primitive_csrf";
const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function setCsrfCookie(res: NextResponse, token: string): void {
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // must be JS-readable for the double-submit pattern
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** Validates double-submit CSRF token. Returns true if valid. */
export function validateCsrfToken(req: NextRequest): boolean {
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}
