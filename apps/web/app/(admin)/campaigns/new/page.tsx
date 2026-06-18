import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NewCampaignClient } from "./NewCampaignClient";

export const metadata = { title: "New Campaign" };

export default async function NewCampaignPage() {
  const session = await getSession();
  const orgId = session.orgId!;

  const orgTemplates = await db.query.campaigns.findMany({
    where: and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, true)),
    orderBy: [desc(campaigns.updatedAt)],
    with: {
      pages: { columns: { id: true } },
      flowNodes: { columns: { id: true, type: true } },
    },
  });

  return <NewCampaignClient orgTemplates={orgTemplates} />;
}
