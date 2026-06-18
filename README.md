# Primitive Campaign Editor

A platform for building, theming, and publishing multi-step marketing campaigns —
landing pages, conditional flows, audience targeting, and email broadcasts.

This is an **npm workspaces monorepo** with three packages:

| Package | Name | Description |
|---|---|---|
| `apps/web` | `@primitive/web` | Next.js 15 (App Router) frontend **and** backend — admin UI, public campaign pages, API routes, DB access |
| `apps/api` | `@primitive/api` | Standalone Node.js HTTP server (SQLite) for local development/seeding of campaign data |
| `packages/campaign-domain` | — | Framework-free domain logic and validation shared across apps |

The web app also depends on a sibling repo at `../primitive-component-library/`
for the `@primitive/*` component, contract, and token packages.

## Features

- **Page builder** — drag-and-drop composition with [`@measured/puck`](https://puckeditor.com),
  reusable blocks, and a convention-based inspector (color/gradient, spacing,
  alignment, radius, dimension controls).
- **Campaign flow engine** — multi-step flows with conditional branching, sticky
  A/B splits, action nodes, and a "test visitor" simulator.
- **Audience & conversions** — per-campaign audience records, segment filtering,
  goal-based conversion tracking, and signed webhook export.
- **Email broadcasts** — visual email designer rendered through
  [React Email](https://react.email), audience segmentation, merge tags, test
  sends, scheduling, delivery tracking, and signed one-click unsubscribe.
- **Theming** — per-campaign brand tokens (color, fonts, radius, density) applied
  consistently across the editor, public pages, and emails.
- **Auth & multi-tenancy** — organizations with `owner` / `editor` / `viewer`
  roles, encrypted sessions, and CSRF protection.

## Tech stack

Next.js 15 · React · TypeScript · Drizzle ORM + PostgreSQL · iron-session ·
Puck · `@xyflow/react` · React Email + Resend · Stripe · Cloudflare R2 ·
Upstash Redis (rate limiting).

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database
- The sibling `../primitive-component-library/` repo checked out alongside this one

### Install

```bash
npm install
```

### Configure

Copy the example env and fill in the values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Key variables (see `apps/web/.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | iron-session encryption key (also signs unsubscribe links) |
| `RESEND_API_KEY` | Resend key — when unset, emails are logged to the console instead of sent |
| `EMAIL_FROM` | Verified sender address |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `http://localhost:3000`) |
| `R2_*` / `STRIPE_*` / `UPSTASH_*` | Media, billing, and rate-limiting integrations |

### Database

Run from `apps/web/`:

```bash
npm run db:generate   # generate Drizzle migrations after schema changes
npm run db:migrate    # apply migrations
npm run db:push       # push schema directly (dev shortcut)
npm run db:studio     # open Drizzle Studio
```

## Commands

Run from the workspace root:

```bash
npm run web:dev       # Next.js dev server (apps/web) — http://localhost:3000
npm run api:dev       # Local SQLite API server (apps/api) — http://localhost:3001
npm run web:build     # Production build
```

## Architecture

### Web app (`apps/web`)

- **Routing** — `app/(admin)/` is the auth-gated admin UI; `app/[orgSlug]/[campaignSlug]/`
  serves public campaign pages; `app/preview/[token]/` serves token-gated previews;
  `app/api/public/` holds unauthenticated visitor endpoints.
- **Auth** — `middleware.ts` validates the session cookie and injects `x-user-id` /
  `x-org-id` headers; route handlers read identity only from those headers. RBAC
  lives in `lib/auth/rbac.ts`.
- **Campaign engine** (`lib/campaign-engine/`) — flow resolution, branch evaluation,
  visitor sessions, template instantiation, and theme resolution.
- **Page builder** (`lib/builder/`) — Puck config and campaign block components used
  in both the editor and public rendering.
- **Email** (`lib/email/`) — block-based design model, React Email renderer, broadcast
  send engine, and signed unsubscribe links.

### Local API server (`apps/api`)

A standalone HTTP server on port 3001 backed by SQLite (`better-sqlite3`), used as a
local data store for campaigns, site pages, and compositions during development.

### Domain package (`packages/campaign-domain`)

Pure validation and tree-manipulation utilities (campaign/page/composition validators,
status and page-type constants) with no framework dependencies.

## Conventions

- Org slug is the public namespace for campaign URLs: `/{orgSlug}/{campaignSlug}`.
- Page content (the component composition tree) is stored as JSONB and edited through
  the domain package's tree utilities.
- The `@/` path alias maps to `apps/web/`.
