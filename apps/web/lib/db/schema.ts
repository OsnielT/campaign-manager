import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";

// ─── Users & Auth ────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // Recorded automatically at signup — proof of consent to Terms / Privacy Policy.
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  // Per-user UI preferences (e.g. dashboard widget visibility + order).
  dashboardPrefs: jsonb("dashboard_prefs"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  // Org-level brand defaults; campaigns inherit these per field (see resolveBrand).
  branding: jsonb("branding").$type<CampaignTheme>(),
  // CAN-SPAM compliance: required in broadcast email footers before a campaign can send.
  legalName: text("legal_name"),
  postalAddress: text("postal_address"),
  // Override the "from" display name in broadcast emails (defaults to org name).
  fromName: text("from_name"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'owner' | 'editor' | 'viewer'
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("org_members_org_user_idx").on(t.orgId, t.userId)]
);

export const orgInvites = pgTable("org_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'editor' | 'viewer'
  tokenHash: text("token_hash").notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("draft"), // 'draft' | 'scheduled' | 'published' | 'expired'
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiryRedirectUrl: text("expiry_redirect_url"),
    expiryPageTree: jsonb("expiry_page_tree"),
    theme: jsonb("theme").$type<CampaignTheme>(),
    isTemplate: boolean("is_template").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("campaigns_org_slug_idx").on(t.orgId, t.slug)]
);

export const campaignPages = pgTable("campaign_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'landing' | 'product' | 'offer' | 'result' | 'confirmation'
  title: text("title").notNull(),
  path: text("path").notNull(),
  isEntry: boolean("is_entry").notNull().default(false),
  isConversionPage: boolean("is_conversion_page").notNull().default(false),
  position: integer("position").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
});

export const campaignPageCompositions = pgTable("campaign_page_compositions", {
  campaignPageId: uuid("campaign_page_id")
    .primaryKey()
    .references(() => campaignPages.id, { onDelete: "cascade" }),
  treeJson: jsonb("tree_json").notNull().default([]),
  schemaVersion: integer("schema_version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Campaign Flow ─────────────────────────────────────────────────────────────

export const campaignFlowNodes = pgTable("campaign_flow_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'start' | 'page' | 'branch' | 'action' | 'end'
  pageId: uuid("page_id").references(() => campaignPages.id),
  label: text("label"),
  // End nodes: a named goal/outcome (e.g. 'purchased' / 'Purchased').
  goalKey: text("goal_key"),
  goalLabel: text("goal_label"),
  goalValue: doublePrecision("goal_value"), // reserved for weighted goals
  // Action nodes: ordered list of FlowAction ops (see lib/campaign-engine/actions.ts).
  actions: jsonb("actions"),
  // Node-type-specific settings (e.g. start source key, A/B weights).
  config: jsonb("config"),
  canvasX: doublePrecision("canvas_x").notNull().default(0),
  canvasY: doublePrecision("canvas_y").notNull().default(0),
});

export const campaignFlowEdges = pgTable("campaign_flow_edges", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  sourceNodeId: uuid("source_node_id")
    .notNull()
    .references(() => campaignFlowNodes.id, { onDelete: "cascade" }),
  targetNodeId: uuid("target_node_id")
    .notNull()
    .references(() => campaignFlowNodes.id, { onDelete: "cascade" }),
  ruleGroup: jsonb("rule_group"), // null = unconditional fallback
  ruleOrder: integer("rule_order").notNull(),
  // Relative weight when the source node is an A/B split (default 1).
  weight: integer("weight"),
});

// ─── Site Pages ────────────────────────────────────────────────────────────────

export const sitePages = pgTable(
  "site_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    path: text("path").notNull(),
    type: text("type").notNull(), // 'home' | 'landing' | 'product' | 'offer' | 'utility'
    campaignId: uuid("campaign_id").references(() => campaigns.id),
  },
  (t) => [uniqueIndex("site_pages_org_path_idx").on(t.orgId, t.path)]
);

// ─── Campaign Sessions & Conversions ──────────────────────────────────────────

export const campaignAudienceRecords = pgTable(
  "campaign_audience_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    lookupKey: text("lookup_key").notNull(),
    name: text("name"),
    email: text("email"),
    fields: jsonb("fields").notNull().default({}),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("audience_records_campaign_key_idx").on(t.campaignId, t.lookupKey),
  ]
);

export const campaignSessions = pgTable("campaign_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  visitorToken: text("visitor_token").notNull().unique(),
  formData: jsonb("form_data").notNull().default({}),
  urlParams: jsonb("url_params").notNull().default({}),
  // Visitor context (device/geo/source), captured once at session creation.
  context: jsonb("context").notNull().default({}),
  audienceRecordId: uuid("audience_record_id").references(
    () => campaignAudienceRecords.id,
    { onDelete: "set null" }
  ),
  currentNodeId: uuid("current_node_id").references(() => campaignFlowNodes.id, {
    onDelete: "set null",
  }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  conversionType: text("conversion_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const campaignConversions = pgTable("campaign_conversions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => campaignSessions.id, { onDelete: "cascade" }),
  audienceRecordId: uuid("audience_record_id").references(
    () => campaignAudienceRecords.id,
    { onDelete: "set null" }
  ),
  triggerType: text("trigger_type").notNull(), // 'form_submit' | 'page_reach' | 'button_click'
  triggerPageId: uuid("trigger_page_id").references(() => campaignPages.id, {
    onDelete: "set null",
  }),
  triggerElementId: text("trigger_element_id"),
  // The named goal reached (from the End node), when the conversion ends a flow.
  goalKey: text("goal_key"),
  goalLabel: text("goal_label"),
  payload: jsonb("payload").notNull().default({}),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  convertedAt: timestamp("converted_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Audience ──────────────────────────────────────────────────────────────────

export const campaignAudienceFields = pgTable(
  "campaign_audience_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull(), // 'text' | 'number' | 'date'
    required: boolean("required").notNull().default(false),
    position: integer("position").notNull(),
    // null = don't set on activation
    // "timestamp" = write ISO timestamp when visitor activates their code
    // "fixed:<value>" = write the literal value after the colon
    onActivation: text("on_activation"),
    // Test-data generator type (see lib/audience/generate.ts). null = infer.
    generator: text("generator"),
  },
  (t) => [uniqueIndex("audience_fields_campaign_key_idx").on(t.campaignId, t.key)]
);

export const campaignAudienceLookupLog = pgTable("campaign_audience_lookup_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  audienceRecordId: uuid("audience_record_id"),
  lookupKey: text("lookup_key").notNull(),
  outcome: text("outcome").notNull(), // 'no_match' | 'matched'
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Products ──────────────────────────────────────────────────────────────────

export const orgProducts = pgTable("org_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").notNull().default({}),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignProducts = pgTable("campaign_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  orgProductId: uuid("org_product_id").references(() => orgProducts.id, {
    onDelete: "set null",
  }),
  nameOverride: text("name_override"),
  descriptionOverride: text("description_override"),
  metadataOverride: jsonb("metadata_override"),
  imageUrlOverride: text("image_url_override"),
  position: integer("position").notNull(),
});

// ─── Webhooks ──────────────────────────────────────────────────────────────────

export const campaignWebhooks = pgTable("campaign_webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" })
    .unique(),
  endpointUrl: text("endpoint_url").notNull(),
  secretHash: text("secret_hash").notNull(),
  payloadFields: text("payload_fields").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => campaignWebhooks.id),
  conversionId: uuid("conversion_id")
    .notNull()
    .references(() => campaignConversions.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull().default(1),
  status: text("status").notNull().default("pending"), // 'pending' | 'delivered' | 'failed'
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Media ─────────────────────────────────────────────────────────────────────

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  r2Key: text("r2_key").notNull().unique(),
  publicUrl: text("public_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Campaign Alerts ───────────────────────────────────────────────────────────

export const campaignAlerts = pgTable("campaign_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'each' | 'threshold' | 'daily'
  threshold: integer("threshold"), // for type 'threshold'
  email: text("email"),
  timezone: text("timezone").default("UTC"),
  enabled: boolean("enabled").notNull().default(true),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Campaign Preview Tokens ───────────────────────────────────────────────────

export const campaignPreviewTokens = pgTable("campaign_preview_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Email Broadcasts ──────────────────────────────────────────────────────────

export const emailBroadcasts = pgTable("email_broadcasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled broadcast"),
  subject: text("subject").notNull().default(""),
  preheader: text("preheader").notNull().default(""),
  fromName: text("from_name"),
  designJson: jsonb("design_json").notNull().default({ blocks: [] }),
  themeOverride: jsonb("theme_override"), // Partial<CampaignTheme> | null
  segmentFilter: jsonb("segment_filter"), // RuleGroup | null
  status: text("status").notNull().default("draft"), // draft | scheduled | sending | sent | failed
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const emailBroadcastRecipients = pgTable("email_broadcast_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  broadcastId: uuid("broadcast_id")
    .notNull()
    .references(() => emailBroadcasts.id, { onDelete: "cascade" }),
  audienceRecordId: uuid("audience_record_id").references(() => campaignAudienceRecords.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  name: text("name"),
  status: text("status").notNull().default("queued"), // queued | sent | failed | skipped
  error: text("error"),
  providerId: text("provider_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  orgMembers: many(orgMembers),
  campaigns: many(campaigns),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  invites: many(orgInvites),
  campaigns: many(campaigns),
  sitePages: many(sitePages),
  products: many(orgProducts),
  mediaAssets: many(mediaAssets),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  org: one(organizations, { fields: [campaigns.orgId], references: [organizations.id] }),
  createdBy: one(users, { fields: [campaigns.createdBy], references: [users.id] }),
  pages: many(campaignPages),
  flowNodes: many(campaignFlowNodes),
  flowEdges: many(campaignFlowEdges),
  audienceFields: many(campaignAudienceFields),
  audienceRecords: many(campaignAudienceRecords),
  sessions: many(campaignSessions),
  conversions: many(campaignConversions),
  products: many(campaignProducts),
  webhook: many(campaignWebhooks),
  broadcasts: many(emailBroadcasts),
}));

export const emailBroadcastsRelations = relations(emailBroadcasts, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [emailBroadcasts.campaignId], references: [campaigns.id] }),
  createdBy: one(users, { fields: [emailBroadcasts.createdBy], references: [users.id] }),
  recipients: many(emailBroadcastRecipients),
}));

export const emailBroadcastRecipientsRelations = relations(emailBroadcastRecipients, ({ one }) => ({
  broadcast: one(emailBroadcasts, { fields: [emailBroadcastRecipients.broadcastId], references: [emailBroadcasts.id] }),
  audienceRecord: one(campaignAudienceRecords, { fields: [emailBroadcastRecipients.audienceRecordId], references: [campaignAudienceRecords.id] }),
}));

export const campaignFlowNodesRelations = relations(campaignFlowNodes, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignFlowNodes.campaignId],
    references: [campaigns.id],
  }),
  page: one(campaignPages, {
    fields: [campaignFlowNodes.pageId],
    references: [campaignPages.id],
  }),
}));

export const campaignFlowEdgesRelations = relations(campaignFlowEdges, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignFlowEdges.campaignId],
    references: [campaigns.id],
  }),
  sourceNode: one(campaignFlowNodes, {
    fields: [campaignFlowEdges.sourceNodeId],
    references: [campaignFlowNodes.id],
    relationName: "edgeSource",
  }),
  targetNode: one(campaignFlowNodes, {
    fields: [campaignFlowEdges.targetNodeId],
    references: [campaignFlowNodes.id],
    relationName: "edgeTarget",
  }),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(campaignWebhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [campaignWebhooks.id],
  }),
  conversion: one(campaignConversions, {
    fields: [webhookDeliveries.conversionId],
    references: [campaignConversions.id],
  }),
}));

export const campaignConversionsRelations = relations(campaignConversions, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignConversions.campaignId],
    references: [campaigns.id],
  }),
  session: one(campaignSessions, {
    fields: [campaignConversions.sessionId],
    references: [campaignSessions.id],
  }),
  audienceRecord: one(campaignAudienceRecords, {
    fields: [campaignConversions.audienceRecordId],
    references: [campaignAudienceRecords.id],
  }),
}));

export const campaignSessionsRelations = relations(campaignSessions, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignSessions.campaignId],
    references: [campaigns.id],
  }),
  audienceRecord: one(campaignAudienceRecords, {
    fields: [campaignSessions.audienceRecordId],
    references: [campaignAudienceRecords.id],
  }),
  currentNode: one(campaignFlowNodes, {
    fields: [campaignSessions.currentNodeId],
    references: [campaignFlowNodes.id],
  }),
}));

export const campaignAudienceFieldsRelations = relations(campaignAudienceFields, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAudienceFields.campaignId],
    references: [campaigns.id],
  }),
}));

export const campaignPagesRelations = relations(campaignPages, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignPages.campaignId],
    references: [campaigns.id],
  }),
  composition: one(campaignPageCompositions, {
    fields: [campaignPages.id],
    references: [campaignPageCompositions.campaignPageId],
  }),
}));

export const orgProductsRelations = relations(orgProducts, ({ one, many }) => ({
  org: one(organizations, { fields: [orgProducts.orgId], references: [organizations.id] }),
  campaignProducts: many(campaignProducts),
}));

export const campaignProductsRelations = relations(campaignProducts, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignProducts.campaignId], references: [campaigns.id] }),
  orgProduct: one(orgProducts, { fields: [campaignProducts.orgProductId], references: [orgProducts.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  org: one(organizations, { fields: [mediaAssets.orgId], references: [organizations.id] }),
  uploadedBy: one(users, { fields: [mediaAssets.uploadedBy], references: [users.id] }),
}));

export const campaignAlertsRelations = relations(campaignAlerts, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignAlerts.campaignId], references: [campaigns.id] }),
}));

export const campaignPreviewTokensRelations = relations(campaignPreviewTokens, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignPreviewTokens.campaignId], references: [campaigns.id] }),
  createdBy: one(users, { fields: [campaignPreviewTokens.createdBy], references: [users.id] }),
}));
