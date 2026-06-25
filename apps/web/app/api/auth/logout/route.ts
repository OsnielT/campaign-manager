import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

async function destroySession() {
  const session = await getSession();
  session.destroy();
  const cookieStore = await cookies();
  cookieStore.delete("primitive_csrf");
}

export async function GET() {
  await destroySession();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
