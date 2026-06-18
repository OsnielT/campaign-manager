import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { orgMembers, orgInvites, users, organizations } from "@/lib/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { MembersClient } from "./MembersClient";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const session = await getSession();
  const orgId = session.orgId!;
  const userId = session.userId!;

  const [org, members, pendingInvites, currentMembership] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, name: true, plan: true },
    }),
    db
      .select({
        id: orgMembers.id,
        role: orgMembers.role,
        joinedAt: orgMembers.joinedAt,
        userId: orgMembers.userId,
        name: users.name,
        email: users.email,
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId)),
    db.query.orgInvites.findMany({
      where: and(
        eq(orgInvites.orgId, orgId),
        isNull(orgInvites.acceptedAt),
        gt(orgInvites.expiresAt, new Date())
      ),
      columns: { id: true, email: true, role: true, expiresAt: true },
    }),
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
  ]);

  const isOwner = currentMembership?.role === "owner";

  return (
    <div style={page}>
      <h1 style={heading}>Members</h1>
      <MembersClient
        orgId={orgId}
        members={members}
        pendingInvites={pendingInvites}
        isOwner={isOwner}
        currentUserId={userId}
        plan={org?.plan ?? "free"}
      />
    </div>
  );
}

const page: React.CSSProperties = { padding: "32px 36px" };
const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "600",
  color: "var(--text-primary)",
  letterSpacing: "-0.4px",
  marginBottom: "28px",
};
