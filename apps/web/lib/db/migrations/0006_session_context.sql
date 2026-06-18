-- Frozen visitor context (device / geo / traffic source) captured at session start.
ALTER TABLE "campaign_sessions" ADD COLUMN IF NOT EXISTS "context" jsonb NOT NULL DEFAULT '{}'::jsonb;
