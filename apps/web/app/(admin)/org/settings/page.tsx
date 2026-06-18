import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { OrgSettingsClient } from "./OrgSettingsClient";

export const metadata: Metadata = { title: "Org Settings" };

export default async function OrgSettingsPage() {
  const session = await getSession();
  const orgId = session.orgId!;
  const userId = session.userId!;

  const [org, membership] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    }),
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
  ]);

  if (!org) return null;

  const isOwner = membership?.role === "owner";

  return (
    <div style={page}>
      <h1 style={heading}>Organization settings</h1>
      <OrgSettingsClient org={org} isOwner={isOwner} />
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
