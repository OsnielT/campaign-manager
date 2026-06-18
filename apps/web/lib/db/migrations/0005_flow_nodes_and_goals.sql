-- Formalize flow node types: 'start' | 'page' | 'branch' | 'action' | 'end'
-- End nodes carry a named goal; action nodes carry an ordered action list.
ALTER TABLE "campaign_flow_nodes" ADD COLUMN IF NOT EXISTS "goal_key" text;
ALTER TABLE "campaign_flow_nodes" ADD COLUMN IF NOT EXISTS "goal_label" text;
ALTER TABLE "campaign_flow_nodes" ADD COLUMN IF NOT EXISTS "goal_value" double precision;
ALTER TABLE "campaign_flow_nodes" ADD COLUMN IF NOT EXISTS "actions" jsonb;
ALTER TABLE "campaign_flow_nodes" ADD COLUMN IF NOT EXISTS "config" jsonb;
--> statement-breakpoint

-- Named goal reached, recorded on the conversion that ends a flow.
ALTER TABLE "campaign_conversions" ADD COLUMN IF NOT EXISTS "goal_key" text;
ALTER TABLE "campaign_conversions" ADD COLUMN IF NOT EXISTS "goal_label" text;
