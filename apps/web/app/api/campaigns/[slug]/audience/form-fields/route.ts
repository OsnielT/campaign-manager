import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPages, campaignPageCompositions, orgMembers } from "@/lib/db/schema";
import { errorResponse, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string }> };

export interface PageFormField {
  key: string;
  label: string;
  pageTitle: string;
  pagePath: string;
  pageId: string;
  componentType: string;
}

/** Recursively walk a Puck tree and collect all form input fields. */
function extractFormFields(tree: unknown, pageTitle: string, pagePath: string, pageId: string): PageFormField[] {
  if (!tree || typeof tree !== "object") return [];

  const fields: PageFormField[] = [];

  function walkItems(items: unknown[]) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const node = item as Record<string, unknown>;
      const type = node.type as string | undefined;
      const props = (node.props ?? {}) as Record<string, unknown>;

      if (type === "Input" && props.name && typeof props.name === "string" && props.name.trim()) {
        fields.push({
          key: props.name,
          label: (props.label as string) || props.name,
          pageTitle,
          pagePath,
          pageId,
          componentType: "Input",
        });
      }

      if (type === "campaign-choice" && props.fieldKey && typeof props.fieldKey === "string" && props.fieldKey.trim()) {
        fields.push({
          key: props.fieldKey,
          label: (props.label as string) || props.fieldKey,
          pageTitle,
          pagePath,
          pageId,
          componentType: "Choice",
        });
      }

      // Recurse into Puck zones
      if (node.zones && typeof node.zones === "object") {
        for (const zone of Object.values(node.zones as Record<string, unknown[]>)) {
          if (Array.isArray(zone)) walkItems(zone);
        }
      }
    }
  }

  const root = tree as Record<string, unknown>;
  if (Array.isArray(root.content)) walkItems(root.content);
  if (root.zones && typeof root.zones === "object") {
    for (const zone of Object.values(root.zones as Record<string, unknown[]>)) {
      if (Array.isArray(zone)) walkItems(zone);
    }
  }

  return fields;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  const pages = await db.query.campaignPages.findMany({
    where: eq(campaignPages.campaignId, campaign.id),
    columns: { id: true, title: true, path: true },
    with: {
      composition: { columns: { treeJson: true } },
    },
  });

  const allFields: PageFormField[] = [];

  for (const page of pages) {
    if (!page.composition?.treeJson) continue;
    const pageFields = extractFormFields(page.composition.treeJson, page.title, page.path, page.id);
    allFields.push(...pageFields);
  }

  const pageList = pages.map((p) => ({ id: p.id, title: p.title, path: p.path }));

  return NextResponse.json({ fields: allFields, pages: pageList });
}
