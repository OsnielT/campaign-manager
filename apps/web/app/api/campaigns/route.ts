import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPages, campaignPageCompositions, campaignFlowNodes, campaignFlowEdges, organizations, orgMembers, emailBroadcasts } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { assertWithinPlan } from "@/lib/stripe/plans";
import { errorResponse, statusFor, forbidden, badRequest, notFound } from "@/lib/errors";
import { eq, and, desc } from "drizzle-orm";
import { instantiateCampaign } from "@/lib/campaign-engine/instantiate";
import { defaultTreeFor } from "@/lib/builder/default-content";
import { emailSeedFor } from "@/lib/email/seed-templates";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

async function getMembership(orgId: string, userId: string) {
  return db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const membership = await getMembership(orgId, userId);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  const rows = await db.query.campaigns.findMany({
    where: and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)),
    orderBy: [desc(campaigns.updatedAt)],
    with: { pages: { columns: { id: true, title: true, isEntry: true } } },
  });

  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const membership = await getMembership(orgId, userId);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "editor");

    const body = await req.json();
    const { name, slug: customSlug, templateId = "blank", isTemplate = false, fromTemplateId } = body ?? {};
    if (!name) {
      return NextResponse.json(errorResponse(badRequest("name is required")), { status: 400 });
    }

    // Templates don't count against the campaign limit
    if (!isTemplate) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { plan: true },
      });
      await assertWithinPlan(orgId, org?.plan ?? "free", "campaigns");
    }

    const slug = customSlug ? slugify(customSlug) : slugify(name);

    // Check org-scoped slug uniqueness
    const existing = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        errorResponse(badRequest("Slug already in use", "SLUG_TAKEN")),
        { status: 409 }
      );
    }

    // ── Case 1: Create from an org template (deep copy) ──────────────────────
    if (fromTemplateId) {
      const template = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, fromTemplateId),
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTemplate, true)
        ),
        columns: { id: true },
      });
      if (!template) {
        return NextResponse.json(errorResponse(notFound("Template")), { status: 404 });
      }
      const campaign = await instantiateCampaign({
        sourceCampaignId: fromTemplateId,
        orgId,
        userId,
        name,
        slug,
        isTemplate: false,
      });
      return NextResponse.json({ campaign }, { status: 201 });
    }

    // ── Case 2: Create from a built-in template (or isTemplate=true) ─────────
    const orgRow = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId), columns: { slug: true } });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const campaignUrl = `${appUrl}/${orgRow?.slug ?? ""}/${slug}`;

    const campaign = await db.transaction(async (tx) => {
      // Cohesive dark starter theme so the dark-styled blocks (Hero, nav,
      // success header, footer) read correctly out of the box.
      const STARTER_THEME = {
        accentColor: "#e8b84b",
        bgColor: "#0d0d2b",
        surfaceColor: "#1a1a3a",
        textColor: "#f5f5fa",
        borderColor: null,
        headingFont: "serif",
        fontFamily: "system",
        radiusStyle: "default" as const,
        density: "comfortable" as const,
        logoUrl: null,
      };

      const [newCampaign] = await tx
        .insert(campaigns)
        .values({ orgId, name, slug, isTemplate, createdBy: userId, theme: STARTER_THEME })
        .returning();

      // When creating a template with no built-in template, start blank
      if (isTemplate) return newCampaign;

      // Page + flow node definitions per built-in template
      type PageDef = { type: string; title: string; path: string; isEntry: boolean; isConversionPage: boolean; position: number; canvasX: number; canvasY: number };
      const TEMPLATE_PAGES: Record<string, PageDef[]> = {
        blank: [
          { type: "landing", title: "Landing Page", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "confirmation", title: "Thank You", path: "/thank-you", isEntry: false, isConversionPage: true, position: 1, canvasX: 100, canvasY: 250 },
        ],
        activation: [
          { type: "landing", title: "Enter Code", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "confirmation", title: "Activated", path: "/activated", isEntry: false, isConversionPage: true, position: 1, canvasX: 100, canvasY: 250 },
        ],
        "lead-capture": [
          { type: "landing", title: "Sign Up", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "confirmation", title: "Thank You", path: "/thank-you", isEntry: false, isConversionPage: true, position: 1, canvasX: 100, canvasY: 250 },
        ],
        "multi-offer": [
          { type: "landing", title: "Select Product", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "offer", title: "Offer A", path: "/offer-a", isEntry: false, isConversionPage: false, position: 1, canvasX: 300, canvasY: 250 },
          { type: "offer", title: "Offer B", path: "/offer-b", isEntry: false, isConversionPage: false, position: 2, canvasX: 500, canvasY: 250 },
          { type: "confirmation", title: "Confirmed", path: "/confirmed", isEntry: false, isConversionPage: true, position: 3, canvasX: 400, canvasY: 400 },
        ],
        webinar: [
          { type: "landing", title: "Landing", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "product", title: "Register", path: "/register", isEntry: false, isConversionPage: false, position: 1, canvasX: 100, canvasY: 240 },
          { type: "offer", title: "VIP Upgrade", path: "/vip", isEntry: false, isConversionPage: false, position: 2, canvasX: 340, canvasY: 380 },
          { type: "confirmation", title: "Registered", path: "/registered", isEntry: false, isConversionPage: true, position: 3, canvasX: 100, canvasY: 520 },
        ],
        "fitness-quiz": [
          { type: "landing", title: "Find Your Plan", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "result", title: "Goal Quiz", path: "/quiz", isEntry: false, isConversionPage: false, position: 1, canvasX: 100, canvasY: 240 },
          { type: "offer", title: "Weight Loss Plan", path: "/plan-weight-loss", isEntry: false, isConversionPage: false, position: 2, canvasX: 60, canvasY: 400 },
          { type: "offer", title: "Muscle Plan", path: "/plan-muscle", isEntry: false, isConversionPage: false, position: 3, canvasX: 300, canvasY: 400 },
          { type: "offer", title: "Active Plan", path: "/plan-active", isEntry: false, isConversionPage: false, position: 4, canvasX: 540, canvasY: 400 },
          { type: "confirmation", title: "Trial Started", path: "/trial-started", isEntry: false, isConversionPage: true, position: 5, canvasX: 300, canvasY: 560 },
        ],
        "vip-access": [
          { type: "landing", title: "Enter Code", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 100 },
          { type: "offer", title: "Your Offer", path: "/reveal", isEntry: false, isConversionPage: false, position: 1, canvasX: 100, canvasY: 240 },
          { type: "confirmation", title: "Reserved", path: "/reserved", isEntry: false, isConversionPage: true, position: 2, canvasX: 100, canvasY: 380 },
        ],
        "b2b-demo": [
          { type: "landing", title: "Welcome", path: "/", isEntry: true, isConversionPage: false, position: 0, canvasX: 100, canvasY: 60 },
          { type: "landing", title: "Landing A", path: "/a", isEntry: false, isConversionPage: false, position: 1, canvasX: 40, canvasY: 320 },
          { type: "landing", title: "Landing B", path: "/b", isEntry: false, isConversionPage: false, position: 2, canvasX: 320, canvasY: 320 },
          { type: "product", title: "Your Details", path: "/details", isEntry: false, isConversionPage: false, position: 3, canvasX: 180, canvasY: 480 },
          { type: "confirmation", title: "Book a Call", path: "/book-a-call", isEntry: false, isConversionPage: true, position: 4, canvasX: 320, canvasY: 640 },
          { type: "confirmation", title: "Download", path: "/download", isEntry: false, isConversionPage: true, position: 5, canvasX: 40, canvasY: 640 },
        ],
      };

      // Flow wiring per template, by node key: "start", "end", or "p{position}".
      // Produces a valid, pre-connected flow so new campaigns pass validation.
      // `rule` (conditional edge) / `weight` (A/B split edge) are optional.
      type EdgeSpec = { from: string; to: string; rule?: Record<string, unknown>; weight?: number };
      // Extra (non-page) nodes a template's graph can introduce.
      type ExtraNode = {
        key: string;
        type: "branch" | "action" | "end";
        label?: string;
        goalKey?: string;
        goalLabel?: string;
        actions?: unknown;
        config?: unknown;
        canvasX?: number;
        canvasY?: number;
      };
      // A condition shorthand for routing on a submitted form field.
      const formEq = (field: string, value: string) => ({
        logic: "and",
        conditions: [{ source: "form", field, operator: "eq", value }],
      });

      const TEMPLATE_FLOW: Record<string, EdgeSpec[]> = {
        blank: [{ from: "start", to: "p0" }, { from: "p0", to: "p1" }, { from: "p1", to: "end" }],
        activation: [{ from: "start", to: "p0" }, { from: "p0", to: "p1" }, { from: "p1", to: "end" }],
        "lead-capture": [{ from: "start", to: "p0" }, { from: "p0", to: "p1" }, { from: "p1", to: "end" }],
        // Select Product routes to the chosen offer (offer=a → A, else → B);
        // both offers converge on Confirmed → End.
        "multi-offer": [
          { from: "start", to: "p0" },
          {
            from: "p0", to: "p1",
            rule: { logic: "and", conditions: [{ source: "form", field: "offer", operator: "eq", value: "a" }] },
          },
          { from: "p0", to: "p2" }, // fallback → Offer B
          { from: "p1", to: "p3" },
          { from: "p2", to: "p3" },
          { from: "p3", to: "end" },
        ],
      };

      // Richer templates: explicit graphs with action/branch/split nodes and
      // multiple named-goal ends. When a template appears here, its `nodes` and
      // `edges` fully define the flow (no auto single-end is created).
      const TEMPLATE_GRAPHS: Record<string, { nodes: ExtraNode[]; edges: EdgeSpec[] }> = {
        webinar: {
          nodes: [
            { key: "act_vip", type: "action", label: "Tag VIP", actions: [{ op: "tag", add: ["vip"] }], canvasX: 340, canvasY: 460 },
            { key: "end_vip", type: "end", goalKey: "vip_registered", goalLabel: "VIP registered", canvasX: 340, canvasY: 640 },
            { key: "end_free", type: "end", goalKey: "registered", goalLabel: "Registered", canvasX: 100, canvasY: 640 },
          ],
          edges: [
            { from: "start", to: "p0" },
            { from: "p0", to: "p1" },
            { from: "p1", to: "p2", rule: formEq("ticket", "vip") },
            { from: "p1", to: "p3" },
            { from: "p2", to: "act_vip" },
            { from: "act_vip", to: "p3" },
            { from: "p3", to: "end_vip", rule: formEq("ticket", "vip") },
            { from: "p3", to: "end_free" },
          ],
        },
        "fitness-quiz": {
          nodes: [
            { key: "end", type: "end", goalKey: "trial_started", goalLabel: "Trial started", canvasX: 300, canvasY: 700 },
          ],
          edges: [
            { from: "start", to: "p0" },
            { from: "p0", to: "p1" },
            { from: "p1", to: "p2", rule: formEq("goal", "lose") },
            { from: "p1", to: "p3", rule: formEq("goal", "muscle") },
            { from: "p1", to: "p4" },
            { from: "p2", to: "p5" },
            { from: "p3", to: "p5" },
            { from: "p4", to: "p5" },
            { from: "p5", to: "end" },
          ],
        },
        "vip-access": {
          nodes: [
            { key: "end", type: "end", goalKey: "redeemed", goalLabel: "Redeemed", canvasX: 100, canvasY: 520 },
          ],
          edges: [
            { from: "start", to: "p0" },
            { from: "p0", to: "p1" },
            { from: "p1", to: "p2" },
            { from: "p2", to: "end" },
          ],
        },
        "b2b-demo": {
          nodes: [
            { key: "split", type: "branch", label: "A/B split", config: { mode: "split" }, canvasX: 180, canvasY: 180 },
            { key: "end_demo", type: "end", goalKey: "demo_booked", goalLabel: "Demo booked", canvasX: 320, canvasY: 800 },
            { key: "end_dl", type: "end", goalKey: "download", goalLabel: "Download", canvasX: 40, canvasY: 800 },
          ],
          edges: [
            { from: "start", to: "p0" },
            { from: "p0", to: "split" },
            { from: "split", to: "p1", weight: 1 },
            { from: "split", to: "p2", weight: 1 },
            { from: "p1", to: "p3" },
            { from: "p2", to: "p3" },
            { from: "p3", to: "p4", rule: formEq("company_size", "enterprise") },
            { from: "p3", to: "p5" },
            { from: "p4", to: "end_demo" },
            { from: "p5", to: "end_dl" },
          ],
        },
      };

      const pageDefs = TEMPLATE_PAGES[templateId as string] ?? TEMPLATE_PAGES.blank;
      const pageNodeIds: string[] = [];

      for (const def of pageDefs) {
        const [pg] = await tx
          .insert(campaignPages)
          .values({
            campaignId: newCampaign.id,
            type: def.type,
            title: def.title,
            path: def.path,
            isEntry: def.isEntry,
            isConversionPage: def.isConversionPage,
            position: def.position,
          })
          .returning();

        // Seed the page with minimal starter content so it's ready to edit.
        await tx.insert(campaignPageCompositions).values({
          campaignPageId: pg.id,
          treeJson: defaultTreeFor(templateId as string, def.position),
          schemaVersion: 2,
        });

        const [fn] = await tx
          .insert(campaignFlowNodes)
          .values({
            campaignId: newCampaign.id,
            type: "page",
            pageId: pg.id,
            label: def.title,
            canvasX: def.canvasX,
            canvasY: def.canvasY,
          })
          .returning({ id: campaignFlowNodes.id });
        pageNodeIds.push(fn.id);
      }

      // Always create the Start node; map flow keys → node ids as we go.
      const lastY = pageDefs.length ? pageDefs[pageDefs.length - 1].canvasY : 100;
      const [startNode] = await tx
        .insert(campaignFlowNodes)
        .values({ campaignId: newCampaign.id, type: "start", canvasX: 100, canvasY: -40 })
        .returning({ id: campaignFlowNodes.id });

      const idByKey = new Map<string, string>();
      idByKey.set("start", startNode.id);
      pageNodeIds.forEach((id, i) => idByKey.set(`p${i}`, id));

      const graph = TEMPLATE_GRAPHS[templateId as string];
      let flowSpec: EdgeSpec[];

      if (graph) {
        // Create the template's extra nodes (action / branch / multiple ends).
        for (const n of graph.nodes) {
          const [created] = await tx
            .insert(campaignFlowNodes)
            .values({
              campaignId: newCampaign.id,
              type: n.type,
              label: n.label ?? null,
              goalKey: n.goalKey ?? null,
              goalLabel: n.goalLabel ?? null,
              actions: (n.actions as unknown) ?? null,
              config: (n.config as unknown) ?? null,
              canvasX: n.canvasX ?? 100,
              canvasY: n.canvasY ?? 0,
            })
            .returning({ id: campaignFlowNodes.id });
          idByKey.set(n.key, created.id);
        }
        flowSpec = graph.edges;
      } else {
        // Simple templates: one auto End + explicit or linear wiring.
        const [endNode] = await tx
          .insert(campaignFlowNodes)
          .values({
            campaignId: newCampaign.id,
            type: "end",
            goalKey: "completed",
            goalLabel: "Completed",
            canvasX: 100,
            canvasY: lastY + 160,
          })
          .returning({ id: campaignFlowNodes.id });
        idByKey.set("end", endNode.id);

        const linear: EdgeSpec[] = pageDefs.map((_, i) => ({
          from: i === 0 ? "start" : `p${i - 1}`,
          to: `p${i}`,
        }));
        if (pageDefs.length) linear.push({ from: `p${pageDefs.length - 1}`, to: "end" });
        flowSpec = TEMPLATE_FLOW[templateId as string] ?? linear;
      }

      const edgeValues = flowSpec
        .map((spec, i) => {
          const sourceNodeId = idByKey.get(spec.from);
          const targetNodeId = idByKey.get(spec.to);
          if (!sourceNodeId || !targetNodeId) return null;
          return {
            campaignId: newCampaign.id,
            sourceNodeId,
            targetNodeId,
            ruleGroup: spec.rule ?? null,
            weight: spec.weight ?? null,
            ruleOrder: i,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (edgeValues.length) {
        await tx.insert(campaignFlowEdges).values(edgeValues);
      }

      // Seed a template-aligned starter email broadcast for the campaign flow.
      const emailSeed = emailSeedFor(templateId as string, campaignUrl);
      if (emailSeed) {
        await tx.insert(emailBroadcasts).values({
          campaignId: newCampaign.id,
          name: emailSeed.name,
          subject: emailSeed.subject,
          preheader: emailSeed.preheader,
          designJson: emailSeed.design,
          createdBy: userId,
        });
      }

      return newCampaign;
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
