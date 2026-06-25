import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orgInvites, orgMembers, organizations } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { InviteTemplate } from "@/lib/email/templates/invite";
import { assertWithinPlan } from "@/lib/stripe/plans";
import { errorResponse, statusFor, forbidden, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { renderAsync } from "@react-email/components";
import React from "react";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "owner");

    const body = await req.json();
    const { email, role } = body ?? {};

    if (!email || !["editor", "viewer"].includes(role)) {
      return NextResponse.json(
        errorResponse(badRequest("email and valid role (editor|viewer) required")),
        { status: 400 }
      );
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, name: true, plan: true },
    });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    await assertWithinPlan(orgId, org.plan, "members");

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(orgInvites).values({
      orgId,
      email,
      role,
      tokenHash,
      invitedBy: userId,
      expiresAt,
    });

    const inviter = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
      with: { user: { columns: { name: true } } },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite?token=${rawToken}`;

    const html = await renderAsync(
      React.createElement(InviteTemplate, {
        inviteUrl,
        orgName: org.name,
        inviterName: (inviter as { user?: { name: string } })?.user?.name ?? "Someone",
        role,
      })
    );

    await sendEmail({ to: email, subject: `You're invited to join ${org.name} on Primitive`, html });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;
  const { inviteId } = await req.json();

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "owner");
    await db
      .delete(orgInvites)
      .where(and(eq(orgInvites.id, inviteId), eq(orgInvites.orgId, orgId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
