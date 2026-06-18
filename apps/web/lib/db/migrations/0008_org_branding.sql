-- Org-level brand defaults; campaigns inherit these per field.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "branding" jsonb;

-- Seed existing orgs with the neutral light default brand.
UPDATE "organizations"
SET "branding" = '{"accentColor":"#4f46e5","bgColor":"#ffffff","surfaceColor":"#f5f6f8","textColor":"#18181b","borderColor":"#e4e4e7","headingFont":"serif","fontFamily":"inter","radiusStyle":"default","logoUrl":null}'::jsonb
WHERE "branding" IS NULL;
