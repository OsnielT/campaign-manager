ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "is_template" boolean NOT NULL DEFAULT false;
