-- A/B split: relative weight on edges leaving a split branch node.
ALTER TABLE "campaign_flow_edges" ADD COLUMN IF NOT EXISTS "weight" integer;
