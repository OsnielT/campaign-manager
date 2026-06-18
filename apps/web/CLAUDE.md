# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> See the workspace-root CLAUDE.md for full monorepo context. This file covers `apps/web` specifics.

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run db:generate  # Generate Drizzle migrations after schema changes
npm run db:migrate   # Apply pending migrations
npm run db:push      # Push schema directly (dev shortcut, skips migration files)
npm run db:studio    # Open Drizzle Studio UI
```

## Route Groups

| Group | Path prefix | Purpose |
|---|---|---|
| `(admin)` | `/dashboard`, `/campaigns`, `/templates`, `/media`, `/org` | Auth-gated admin UI |
| `(auth)` | `/login`, `/signup`, `/forgot-password`, etc. | Unauthenticated auth flows |
| `[orgSlug]/[campaignSlug]` | Public campaign pages served to visitors |
| `api/public/` | Unauthenticated campaign session/submit/lookup endpoints |
| `api/` (everything else) | Auth-required API routes |
| `preview/[token]` | Token-gated campaign preview (no session required) |

## Auth & Identity

Middleware (`middleware.ts`) validates `iron-session` cookies and injects `x-user-id` / `x-org-id` request headers for all protected routes. Route handlers read identity exclusively from these headers — never from the request body or query params.

CSRF tokens are validated on all mutating API calls (`POST/PUT/PATCH/DELETE`) to protected routes. Public API routes (`/api/public/`, `/api/auth/`, `/api/webhooks/`, `/api/cron/`) are exempt.

RBAC roles (`owner`, `editor`, `viewer`) are enforced in `lib/auth/rbac.ts`.

## Campaign Engine (`lib/campaign-engine/`)

Campaigns are multi-step flows with conditional branching. Flow nodes (`campaignFlowNodes.type`) are `start` | `page` | `branch` | `action` | `end`; `end` nodes carry a named goal (`goalKey`/`goalLabel`), `action` nodes carry an ordered `actions` list. A `branch` node with `config.mode === "split"` is an A/B split: its outgoing edges carry a `weight`, and selection is sticky per visitor (hash of the visitor token).

- **`flow.ts`** — walks the graph from the current node through `branch`/`action` nodes to the next page; loads the linked audience record into the branch context so `record.*` conditions match, executes action nodes, and detects terminal pages (forward path reaches an `end` goal)
- **`branch.ts`** — pure evaluator for rule groups. Sources: `form`/`url`/`record`/`context` (device·geo·source)/`time` (hour·dow·date·elapsed). Values may be literals or field references (`{ ref: { source, field } }`); groups nest for arbitrary AND/OR. Also `pickWeightedEdge` + `hashToUnit` for sticky A/B splits. No DB calls
- **`context.ts`** — `buildVisitorContext` captures device (User-Agent) + geo (Cloudflare `cf-*` headers) + UTM/referrer at session creation, frozen on `campaignSessions.context`
- **`actions.ts`** — pure flow-action engine (`set`/`copy`/`compute`/`tag`); patches persist via `patchAudienceRecordFields`
- **`simulate.ts`** — pure `simulateFlow` (dry-run with sample inputs) + `validateFlow` (static checks for the simulator and pre-publish gate in `publish/route.ts`)
- **`conversion.ts`** — records conversions with goal; `buildWebhookPayload` + `mergeExportable` produce the enriched, HMAC-signed export (record fields + tags + goal, not just form data)
- **`session.ts`** — reads/writes visitor progress (`campaignSessions` table); `patchAudienceRecordFields` JSONB-merges field patches
- **`instantiate.ts`** — creates a new campaign's pages/flow from a template
- **`resolve.ts`** — resolves dynamic component props for public rendering
- **`theme.ts`** — extracts and applies campaign theme tokens to rendered blocks

The unified canvas editor (`FlowEditor.tsx`) builds all node types on one surface and has a "Test visitor" simulator panel (`POST /api/campaigns/[slug]/simulate`). Pure-engine tests run with `npm test`.

## Page Builder (`lib/builder/`)

Uses `@measured/puck` for drag-and-drop page composition. `puck-config.tsx` registers all block types; `campaign-blocks.tsx` implements block components used in both the Puck editor and the public `PrimitiveRenderer`. The composition tree is stored as JSONB in `campaignPages.composition`.

## Public Campaign Flow

1. Visitor hits `/{orgSlug}/{campaignSlug}` — SSR renders the entry page composition
2. Form submit → `POST /api/public/{orgSlug}/{campaignSlug}/submit` — runs campaign engine, returns next page path
3. `SessionInitializer` client component (`components/public/`) initializes a visitor session cookie on first load
4. Audience lookup → `POST /api/public/.../lookup` — matches visitor against `audienceRecords` for personalization

## Database

PostgreSQL via Drizzle ORM. Schema defined in `lib/db/schema.ts`. Key table groups:

- **Users & Auth**: `users`, `emailVerifications`, `passwordResetTokens`
- **Orgs**: `organizations`, `orgMembers`, `orgInvites`
- **Campaigns**: `campaigns`, `campaignPages`, `campaignFlowNodes`, `campaignFlowEdges`, `campaignSessions`, `audienceRecords`, `conversions`
- **Products**: `products` (org-level), `campaignProducts`
- **Media**: `mediaAssets` (backed by Cloudflare R2)
- **Templates**: `campaignTemplates`

After editing `lib/db/schema.ts`, run `npm run db:generate` then `npm run db:migrate`.

## Key Libraries

| Library | Purpose |
|---|---|
| `@measured/puck` | Drag-and-drop page builder |
| `@xyflow/react` | Flow graph editor (campaign flow UI) |
| `drizzle-orm` + `postgres` | DB ORM |
| `iron-session` | Encrypted session cookies |
| `resend` + `@react-email/components` | Transactional email |
| `@aws-sdk/client-s3` | Cloudflare R2 uploads |
| `stripe` | Billing |
| `@upstash/ratelimit` + `@upstash/redis` | Rate limiting |
| `@primitive/*` | Component library (sibling repo) |
