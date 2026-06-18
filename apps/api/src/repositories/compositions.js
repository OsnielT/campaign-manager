import { validateCampaignPageComposition } from "@primitive/campaign-domain";

import { createHttpError } from "../utils/http.js";

const COMPOSITION_SCHEMA_VERSION = 1;

function getCampaignRowBySlug(database, slug) {
  return database.prepare(`
    SELECT slug
    FROM campaigns
    WHERE slug = ?
    LIMIT 1
  `).get(slug);
}

function getCampaignPageRowsBySlug(database, slug) {
  return database.prepare(`
    SELECT id
    FROM campaign_pages
    WHERE campaign_slug = ?
    ORDER BY position ASC
  `).all(slug);
}

function getCampaignPageRowById(database, pageId) {
  return database.prepare(`
    SELECT id
    FROM campaign_pages
    WHERE id = ?
    LIMIT 1
  `).get(pageId);
}

function getCompositionRowsByPageIds(database, pageIds) {
  if (!pageIds.length) {
    return [];
  }

  const placeholders = pageIds.map(() => "?").join(", ");

  return database.prepare(`
    SELECT campaign_page_id, tree_json, schema_version, updated_at
    FROM campaign_page_compositions
    WHERE campaign_page_id IN (${placeholders})
  `).all(...pageIds);
}

function getCompositionRowByPageId(database, pageId) {
  return database.prepare(`
    SELECT campaign_page_id, tree_json, schema_version, updated_at
    FROM campaign_page_compositions
    WHERE campaign_page_id = ?
    LIMIT 1
  `).get(pageId);
}

function parseTreeJson(treeJson, label) {
  try {
    const parsed = JSON.parse(treeJson);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error(`${label} is malformed JSON: ${error.message}`);
  }
}

function mapComposition(pageId, row) {
  return {
    pageId,
    nodes: row ? parseTreeJson(row.tree_json, `Composition for "${pageId}"`) : []
  };
}

function assertCampaignExists(database, slug) {
  if (!getCampaignRowBySlug(database, slug)) {
    throw createHttpError(404, `Campaign "${slug}" was not found.`);
  }
}

function assertCampaignPageExists(database, pageId) {
  if (!getCampaignPageRowById(database, pageId)) {
    throw createHttpError(404, `Campaign page "${pageId}" was not found.`);
  }
}

export function listCampaignCompositions(database, slug) {
  assertCampaignExists(database, slug);

  const pageIds = getCampaignPageRowsBySlug(database, slug).map((row) => row.id);
  const rows = getCompositionRowsByPageIds(database, pageIds);
  const compositionByPageId = new Map(
    rows.map((row) => [row.campaign_page_id, row])
  );

  return {
    pages: pageIds.map((pageId) => mapComposition(pageId, compositionByPageId.get(pageId) ?? null))
  };
}

export function getPageComposition(database, pageId) {
  assertCampaignPageExists(database, pageId);

  return mapComposition(pageId, getCompositionRowByPageId(database, pageId));
}

export function savePageComposition(database, pageId, nodes) {
  assertCampaignPageExists(database, pageId);

  const composition = {
    pageId,
    nodes
  };
  const validation = validateCampaignPageComposition(composition);

  if (!validation.valid) {
    throw createHttpError(400, "Campaign page composition validation failed.", validation.errors);
  }

  const upsertComposition = database.prepare(`
    INSERT INTO campaign_page_compositions (
      campaign_page_id,
      tree_json,
      schema_version,
      updated_at
    )
    VALUES (@pageId, @treeJson, @schemaVersion, @updatedAt)
    ON CONFLICT(campaign_page_id) DO UPDATE SET
      tree_json = excluded.tree_json,
      schema_version = excluded.schema_version,
      updated_at = excluded.updated_at
  `);
  const saveTransaction = database.transaction((nextComposition) => {
    upsertComposition.run({
      pageId: nextComposition.pageId,
      treeJson: JSON.stringify(nextComposition.nodes),
      schemaVersion: COMPOSITION_SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    });
  });

  saveTransaction(composition);

  return getPageComposition(database, pageId);
}
