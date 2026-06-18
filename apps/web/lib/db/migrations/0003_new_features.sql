-- SEO meta fields on campaign pages
ALTER TABLE "campaign_pages" ADD COLUMN IF NOT EXISTS "meta_title" text;
ALTER TABLE "campaign_pages" ADD COLUMN IF NOT EXISTS "meta_description" text;
--> statement-breakpoint

-- Campaign alerts (conversion notifications)
CREATE TABLE IF NOT EXISTS "campaign_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "threshold" integer,
  "email" text,
  "timezone" text DEFAULT 'UTC',
  "enabled" boolean NOT NULL DEFAULT true,
  "last_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Campaign preview tokens (shareable draft links)
CREATE TABLE IF NOT EXISTS "campaign_preview_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
