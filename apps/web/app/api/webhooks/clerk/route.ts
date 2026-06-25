import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users, organizations, orgMembers, sitePages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NEUTRAL_LIGHT_BRAND } from "@/lib/campaign-engine/theme";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function uniqueSlug(base: string): string {
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

type ClerkEvent =
  | {
      type: "user.created" | "user.updated";
      data: {
        id: string;
        email_addresses: { email_address: string; id: string }[];
        primary_email_address_id: string;
        first_name: string | null;
        last_name: string | null;
      };
    }
  | {
      type: "organization.created";
      data: {
        id: string;
        name: string;
        slug: string | null;
        created_by: string;
      };
    }
  | {
      type: "organizationMembership.created";
      data: {
        organization: { id: string };
        public_user_data: { user_id: string };
        role: string;
      };
    }
  | { type: string; data: unknown };

async function verify(req: NextRequest): Promise<ClerkEvent> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("CLERK_WEBHOOK_SECRET not set");

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) throw new Error("Missing svix headers");

  const body = await req.text();
  const wh = new Webhook(webhookSecret);
  return wh.verify(body, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as ClerkEvent;
}

export async function POST(req: NextRequest) {
  let event: ClerkEvent;
  try {
    event = await verify(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    const status = msg === "CLERK_WEBHOOK_SECRET not set" ? 500 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // ── user.created ─────────────────────────────────────────────────────────────
  if (event.type === "user.created") {
    const { id: clerkId, email_addresses, primary_email_address_id, first_name, last_name } = event.data;
    const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id);
    if (!primaryEmail) return NextResponse.json({ error: "No primary email" }, { status: 400 });

    const email = primaryEmail.email_address;
    const name = [first_name, last_name].filter(Boolean).join(" ") || email.split("@")[0];

    const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (existing) {
      await db.update(users).set({ clerkId }).where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({ clerkId, email, name });
    }
  }

  // ── user.updated ─────────────────────────────────────────────────────────────
  if (event.type === "user.updated") {
    const { id: clerkId, email_addresses, primary_email_address_id, first_name, last_name } = event.data;
    const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id);
    if (primaryEmail) {
      const name = [first_name, last_name].filter(Boolean).join(" ") || primaryEmail.email_address.split("@")[0];
      await db.update(users).set({ email: primaryEmail.email_address, name }).where(eq(users.clerkId, clerkId));
    }
  }

  // ── organization.created ──────────────────────────────────────────────────────
  // Fires when the user creates an org inside Clerk's own sign-up flow.
  if (event.type === "organization.created") {
    const { id: clerkOrgId, name, slug: clerkSlug } = event.data;

    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, clerkOrgId),
      columns: { id: true },
    });
    if (!existing) {
      const base = slugify(clerkSlug ?? name);
      const slugCandidate = base || uniqueSlug("org");

      // Resolve slug collision with a short random suffix
      const taken = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slugCandidate),
        columns: { id: true },
      });
      const slug = taken ? uniqueSlug(base) : slugCandidate;

      await db.transaction(async (tx) => {
        const [newOrg] = await tx
          .insert(organizations)
          .values({ name, slug, clerkOrgId, branding: NEUTRAL_LIGHT_BRAND })
          .returning({ id: organizations.id });

        await tx.insert(sitePages).values({ orgId: newOrg.id, title: "Home", path: "/", type: "home" });
      });
    }
  }

  // ── organizationMembership.created ───────────────────────────────────────────
  // Fires when a user is added to an org — link user to the DB org row.
  if (event.type === "organizationMembership.created") {
    const { organization: { id: clerkOrgId }, public_user_data: { user_id: clerkUserId }, role } = event.data;

    const [org, user] = await Promise.all([
      db.query.organizations.findFirst({ where: eq(organizations.clerkOrgId, clerkOrgId), columns: { id: true } }),
      db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId), columns: { id: true } }),
    ]);

    if (org && user) {
      const alreadyMember = await db.query.orgMembers.findFirst({
        where: (m, { and }) => and(eq(m.orgId, org.id), eq(m.userId, user.id)),
        columns: { id: true },
      });
      if (!alreadyMember) {
        // Map Clerk role (org:admin, org:member) to our role schema
        const dbRole = role === "org:admin" ? "owner" : "editor";
        await db.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: dbRole });
      }
    }
  }

  return NextResponse.json({ received: true });
}
