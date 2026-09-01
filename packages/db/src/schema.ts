import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "editor", "analyst"]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const brandStatusEnum = pgEnum("brand_status", ["active", "archived"]);
export const domainStatusEnum = pgEnum("domain_status", ["pending", "verified", "disabled"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "archived"]);
export const pageStatusEnum = pgEnum("page_status", ["draft", "archived"]);
export const assetTypeEnum = pgEnum("asset_type", ["image", "video", "gif", "svg"]);
export const experimentStatusEnum = pgEnum("experiment_status", ["draft", "running", "paused", "ended"]);
export const aiJobStatusEnum = pgEnum("ai_job_status", ["queued", "running", "completed", "failed"]);

export const users = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    role: userRoleEnum("role").notNull().default("analyst"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("app_users_email_uidx").on(table.email)]
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: brandStatusEnum("status").notNull().default("active"),
    logoAssetId: uuid("logo_asset_id"),
    faviconAssetId: uuid("favicon_asset_id"),
    defaultSocialAssetId: uuid("default_social_asset_id"),
    theme: jsonb("theme").$type<JsonObject>().notNull().default({}),
    defaults: jsonb("defaults").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [uniqueIndex("brands_slug_uidx").on(table.slug), index("brands_status_idx").on(table.status)]
);

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    status: domainStatusEnum("status").notNull().default("pending"),
    isPrimary: boolean("is_primary").notNull().default(false),
    verificationData: jsonb("verification_data").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("domains_hostname_uidx").on(table.hostname),
    index("domains_brand_idx").on(table.brandId),
    index("domains_status_idx").on(table.status)
  ]
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("offers_brand_slug_uidx").on(table.brandId, table.slug), index("offers_brand_idx").on(table.brandId)]
);

export const offerVersions = pgTable(
  "offer_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    currency: text("currency").notNull().default("PKR"),
    initialAmount: numeric("initial_amount", { precision: 12, scale: 2 }),
    recurringAmount: numeric("recurring_amount", { precision: 12, scale: 2 }),
    billingInterval: text("billing_interval"),
    trialDays: integer("trial_days"),
    autoRenew: boolean("auto_renew").notNull().default(false),
    benefit: jsonb("benefit").$type<JsonObject>().notNull().default({}),
    terms: jsonb("terms").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [uniqueIndex("offer_versions_offer_number_uidx").on(table.offerId, table.versionNumber)]
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    offerVersionId: uuid("offer_version_id").references(() => offerVersions.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    platform: text("platform").notNull(),
    objective: text("objective").notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    externalIds: jsonb("external_ids").$type<JsonObject>().notNull().default({}),
    utmDefaults: jsonb("utm_defaults").$type<JsonObject>().notNull().default({}),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [index("campaigns_brand_status_idx").on(table.brandId, table.status), index("campaigns_platform_idx").on(table.platform)]
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    content: jsonb("content").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("templates_brand_slug_uidx").on(table.brandId, table.slug)]
);

export const landingPages = pgTable(
  "landing_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    domainId: uuid("domain_id").references(() => domains.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: pageStatusEnum("status").notNull().default("draft"),
    conversionGoal: text("conversion_goal"),
    draftContent: jsonb("draft_content").$type<JsonObject>().notNull().default({}),
    draftSeo: jsonb("draft_seo").$type<JsonObject>().notNull().default({}),
    draftRevision: integer("draft_revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [
    uniqueIndex("landing_pages_brand_slug_uidx").on(table.brandId, table.slug),
    index("landing_pages_campaign_idx").on(table.campaignId),
    index("landing_pages_domain_idx").on(table.domainId),
    index("landing_pages_updated_idx").on(table.updatedAt)
  ]
);

export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id").notNull().references(() => landingPages.id, { onDelete: "cascade" }),
    offerVersionId: uuid("offer_version_id").references(() => offerVersions.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    content: jsonb("content").$type<JsonObject>().notNull(),
    seo: jsonb("seo").$type<JsonObject>().notNull().default({}),
    publishNote: text("publish_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [
    uniqueIndex("page_versions_page_number_uidx").on(table.pageId, table.versionNumber),
    uniqueIndex("page_versions_id_page_uidx").on(table.id, table.pageId),
    index("page_versions_page_created_idx").on(table.pageId, table.createdAt)
  ]
);

export const pagePublications = pgTable("page_publications", {
  pageId: uuid("page_id").primaryKey().references(() => landingPages.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull().references(() => pageVersions.id, { onDelete: "restrict" }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" })
});

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    type: assetTypeEnum("type").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    title: text("title"),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
    fileSize: bigint("file_size", { mode: "number" }),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [uniqueIndex("assets_storage_key_uidx").on(table.storageKey), index("assets_brand_type_idx").on(table.brandId, table.type)]
);

export const assetUsages = pgTable(
  "asset_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fieldPath: text("field_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("asset_usages_unique_uidx").on(table.assetId, table.entityType, table.entityId, table.fieldPath),
    index("asset_usages_entity_idx").on(table.entityType, table.entityId)
  ]
);

export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id").notNull().references(() => landingPages.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: experimentStatusEnum("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("experiments_page_status_idx").on(table.pageId, table.status)]
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    experimentId: uuid("experiment_id").notNull().references(() => experiments.id, { onDelete: "cascade" }),
    pageVersionId: uuid("page_version_id").notNull().references(() => pageVersions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    allocation: integer("allocation").notNull(),
    isControl: boolean("is_control").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("variants_experiment_idx").on(table.experimentId)]
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: text("event_id").notNull(),
    eventName: text("event_name").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => landingPages.id, { onDelete: "set null" }),
    versionId: uuid("version_id").references(() => pageVersions.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    creativeId: text("creative_id"),
    sessionId: text("session_id"),
    anonymousId: text("anonymous_id"),
    userId: text("user_id"),
    source: text("source"),
    medium: text("medium"),
    campaignName: text("campaign_name"),
    term: text("term"),
    content: text("content"),
    properties: jsonb("properties").$type<JsonObject>().notNull().default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("analytics_events_event_id_uidx").on(table.eventId),
    index("analytics_events_occurred_idx").on(table.occurredAt),
    index("analytics_events_campaign_occurred_idx").on(table.campaignId, table.occurredAt),
    index("analytics_events_page_occurred_idx").on(table.pageId, table.occurredAt),
    index("analytics_events_variant_occurred_idx").on(table.variantId, table.occurredAt)
  ]
);

export const conversions = pgTable(
  "conversions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    eventName: text("event_name").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => landingPages.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    value: numeric("value", { precision: 14, scale: 2 }),
    currency: text("currency"),
    attribution: jsonb("attribution").$type<JsonObject>().notNull().default({}),
    properties: jsonb("properties").$type<JsonObject>().notNull().default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("conversions_idempotency_uidx").on(table.idempotencyKey),
    index("conversions_occurred_idx").on(table.occurredAt),
    index("conversions_campaign_occurred_idx").on(table.campaignId, table.occurredAt)
  ]
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("disabled"),
    publicConfig: jsonb("public_config").$type<JsonObject>().notNull().default({}),
    secretRef: text("secret_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("integrations_brand_provider_uidx").on(table.brandId, table.provider)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before").$type<JsonObject>(),
    after: jsonb("after").$type<JsonObject>(),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId), index("audit_logs_created_idx").on(table.createdAt)]
);

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    provider: text("provider"),
    model: text("model"),
    status: aiJobStatusEnum("status").notNull().default("queued"),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [index("ai_jobs_status_created_idx").on(table.status, table.createdAt)]
);
