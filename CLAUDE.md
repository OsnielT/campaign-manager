# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Structure

This is an npm workspaces monorepo with three packages:

- **`apps/web`** (`@primitive/web`) — Next.js 15 App Router frontend + backend (API routes, DB access)
- **`apps/api`** (`@primitive/api`) — Standalone Node.js HTTP server (SQLite via better-sqlite3) for local development/seeding of campaign data
- **`packages/campaign-domain`** — Shared pure JS domain logic and validation (no framework dependencies)

The web app also depends on a sibling repo at `../primitive-component-library/` for `@primitive/contracts`, `@primitive/primitives`, `@primitive/react`, `@primitive/semantics`, and `@primitive/tokens`.

## Commands

Run from the workspace root:

```bash
npm run web:dev        # Next.js dev server (apps/web)
npm run api:dev        # Local API server on :3001 (apps/api)
npm run web:build      # Production build
```

Run from `apps/web/` for DB commands:

```bash
npm run db:generate    # Generate Drizzle migrations from schema changes
npm run db:migrate     # Apply migrations
npm run db:push        # Push schema directly (dev shortcut)
npm run db:studio      # Open Drizzle Studio UI
```

There are no test scripts currently configured.

## Architecture

### Web App (`apps/web`)

**Auth & Sessions** — `iron-session` for encrypted session cookies. Middleware (`middleware.ts`) injects `x-user-id` and `x-org-id` headers into protected route handlers. CSRF tokens guard all mutating API calls. Auth utilities live in `lib/auth/`.

**Database** — PostgreSQL via Drizzle ORM. Schema in `lib/db/schema.ts`. Key entities: `users`, `organizations`, `orgMembers`, `campaigns`, `campaignPages`, `campaignFlowNodes`, `campaignFlowEdges`, `audienceRecords`. Rate limiting via Upstash Redis.

**Campaign Engine** (`lib/campaign-engine/`) — Core logic for multi-step campaigns:
- `flow.ts` — resolves the next page in a campaign flow by walking flow graph edges and evaluating branch conditions
- `branch.ts` — evaluates rule groups against session/form data for conditional branching
- `session.ts` — tracks visitor progress through a campaign
- `instantiate.ts` — instantiates campaign page compositions from templates
- `resolve.ts` / `theme.ts` — resolves component props and campaign theme

**Page Builder** (`lib/builder/`) — Uses `@measured/puck` as the drag-and-drop page builder. `puck-config.tsx` defines available blocks; `campaign-blocks.tsx` implements the block components rendered in both the editor and public pages.

**Public Campaign Routes** — `app/[orgSlug]/[campaignSlug]/` serves campaign pages publicly. `app/preview/[token]/` serves preview pages without auth.

**Admin Routes** — `app/(admin)/` — dashboard, campaign management, template library, media, org settings. Auth-gated via middleware.

**Email** — Resend + React Email. Templates in `lib/email/templates/`.

**Media** — Cloudflare R2 (`lib/r2/`). Presigned upload URLs served from `app/api/media/`.

**Billing** — Stripe integration (`lib/stripe/`). Webhook handler at `app/api/webhooks/`.

**Cron** — `app/api/cron/` + `lib/cron/tick.ts` handles scheduled campaign state transitions (e.g., auto-expiry).

### Local API Server (`apps/api`)

Runs on port 3001. Serves CRUD endpoints for campaigns, site pages, and page compositions backed by SQLite. Used as a local data store for development outside of the production Postgres setup.

### Campaign Domain Package (`packages/campaign-domain`)

Pure validation and domain logic shared between apps. Defines `CAMPAIGN_PAGE_TYPES`, `CAMPAIGN_STATUSES`, campaign/page/composition validators, and tree manipulation utilities for the component composition tree.

## Key Conventions

- Route handlers read `x-user-id` / `x-org-id` from request headers (set by middleware) — never trust client-supplied identity.
- RBAC roles: `owner`, `editor`, `viewer` — enforced in `lib/auth/rbac.ts`.
- Org slug is the public namespace for all campaign URLs: `/{orgSlug}/{campaignSlug}`.
- The component composition tree (page content) is stored as JSONB in the DB and manipulated via the domain package's tree utilities.
- `@/` path alias maps to `apps/web/`.
