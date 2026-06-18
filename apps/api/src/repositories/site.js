import { validateSite, validateSitePage } from "@primitive/campaign-domain";

import { createHttpError } from "../utils/http.js";

function mapSitePageRow(row) {
  return {
    id: row.id,
    siteId: row.site_id,
    title: row.title,
    path: row.path,
    type: row.type,
    campaignSlug: row.campaign_slug
  };
}

function mapSiteRow(row, pages) {
  return {
    id: row.id,
    name: row.name,
    basePath: row.base_path,
    pages
  };
}

function listCampaigns(database) {
  return database.prepare(`
    SELECT slug
    FROM campaigns
    ORDER BY slug ASC
  `).all().map((row) => ({ slug: row.slug }));
}

function getSiteRow(database) {
  return database.prepare(`
    SELECT id, name, base_path
    FROM site
    LIMIT 1
  `).get();
}

function getSitePageRows(database, siteId) {
  return database.prepare(`
    SELECT id, site_id, title, path, type, campaign_slug
    FROM site_pages
    WHERE site_id = ?
    ORDER BY path ASC, id ASC
  `).all(siteId);
}

function getSitePageRowById(database, pageId) {
  return database.prepare(`
    SELECT id, site_id, title, path, type, campaign_slug
    FROM site_pages
    WHERE id = ?
  `).get(pageId);
}

function pathExists(database, path, excludeId) {
  const row = database.prepare(`
    SELECT id
    FROM site_pages
    WHERE path = ?
      AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(path, excludeId ?? null, excludeId ?? null);

  return Boolean(row);
}

function buildSitePageId(title, type, existingPages) {
  const base = `${type}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `${type}-page`;
  const existingIds = new Set(existingPages.map((page) => page.id));

  if (!existingIds.has(base)) {
    return base;
  }

  let index = 2;

  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

function normalizePath(path) {
  const trimmed = String(path ?? "").trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getSite(database) {
  const siteRow = getSiteRow(database);

  if (!siteRow) {
    throw createHttpError(500, "Site record is missing.");
  }

  const site = mapSiteRow(siteRow, getSitePageRows(database, siteRow.id).map(mapSitePageRow));
  const result = validateSite(site, {
    campaigns: listCampaigns(database)
  });

  if (!result.valid) {
    throw new Error(`Site data is invalid: ${result.errors.join(" | ")}`);
  }

  return site;
}

function validateNewSitePage(database, page) {
  const campaigns = listCampaigns(database);
  const result = validateSitePage(page, { campaigns });

  if (!result.valid) {
    throw createHttpError(400, "Site page validation failed.", result.errors);
  }

  if (pathExists(database, page.path)) {
    throw createHttpError(409, `Site page path "${page.path}" is already in use.`);
  }
}

function assertCampaignExists(database, campaignSlug) {
  if (campaignSlug === null) {
    return;
  }

  const row = database.prepare(`
    SELECT slug
    FROM campaigns
    WHERE slug = ?
    LIMIT 1
  `).get(campaignSlug);

  if (!row) {
    throw createHttpError(400, `Campaign "${campaignSlug}" does not exist.`);
  }
}

export function fetchSite(database) {
  return getSite(database);
}

export function createSitePage(database, input) {
  const site = getSite(database);
  const page = {
    id: buildSitePageId(input.title, input.type, site.pages),
    siteId: site.id,
    title: String(input.title ?? "").trim(),
    path: normalizePath(input.path),
    type: input.type,
    campaignSlug: null
  };

  validateNewSitePage(database, page);

  const createTransaction = database.transaction((nextPage) => {
    database.prepare(`
      INSERT INTO site_pages (id, site_id, title, path, type, campaign_slug)
      VALUES (@id, @siteId, @title, @path, @type, @campaignSlug)
    `).run(nextPage);
  });

  createTransaction(page);

  return getSitePageById(database, page.id);
}

export function getSitePageById(database, pageId) {
  const row = getSitePageRowById(database, pageId);

  if (!row) {
    return null;
  }

  return mapSitePageRow(row);
}

export function deleteSitePage(database, pageId) {
  const page = getSitePageById(database, pageId);

  if (!page) {
    throw createHttpError(404, `Site page "${pageId}" was not found.`);
  }

  if (page.type === "home") {
    throw createHttpError(403, "Home page cannot be deleted");
  }

  const deleteTransaction = database.transaction((id) => {
    database.prepare(`
      DELETE FROM site_pages
      WHERE id = ?
    `).run(id);
  });

  deleteTransaction(pageId);
}

export function updateSitePage(database, pageId, input) {
  const currentPage = getSitePageById(database, pageId);

  if (!currentPage) {
    throw createHttpError(404, `Site page "${pageId}" was not found.`);
  }

  const nextType = input.type;

  if (currentPage.type === "home" && nextType !== "home") {
    throw createHttpError(403, "Home page type cannot be changed");
  }

  const nextPage = {
    id: currentPage.id,
    siteId: currentPage.siteId,
    title: String(input.title ?? "").trim(),
    path: normalizePath(input.path),
    type: nextType,
    campaignSlug: currentPage.campaignSlug
  };

  const campaigns = listCampaigns(database);
  const result = validateSitePage(nextPage, { campaigns });

  if (!result.valid) {
    throw createHttpError(400, "Site page validation failed.", result.errors);
  }

  if (pathExists(database, nextPage.path, pageId)) {
    throw createHttpError(409, `Site page path "${nextPage.path}" is already in use.`);
  }

  const updateTransaction = database.transaction((page) => {
    database.prepare(`
      UPDATE site_pages
      SET title = @title,
          path = @path,
          type = @type
      WHERE id = @id
    `).run(page);
  });

  updateTransaction(nextPage);

  return getSitePageById(database, pageId);
}

export function assignSitePageCampaign(database, pageId, campaignSlug) {
  const page = getSitePageById(database, pageId);

  if (!page) {
    throw createHttpError(404, `Site page "${pageId}" was not found.`);
  }

  assertCampaignExists(database, campaignSlug);

  const assignTransaction = database.transaction((id, nextCampaignSlug) => {
    database.prepare(`
      UPDATE site_pages
      SET campaign_slug = ?
      WHERE id = ?
    `).run(nextCampaignSlug, id);
  });

  assignTransaction(pageId, campaignSlug);

  return getSitePageById(database, pageId);
}
