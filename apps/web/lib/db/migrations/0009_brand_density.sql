-- Add the density token to existing org branding (Phase 2 spacing presets).
UPDATE "organizations"
SET "branding" = "branding" || '{"density":"comfortable"}'::jsonb
WHERE "branding" IS NOT NULL AND NOT ("branding" ? 'density');
