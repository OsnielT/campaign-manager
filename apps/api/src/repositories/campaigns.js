import {
  isCampaignSlugUnique,
  validateCampaign,
  validateCampaignCollection
} from "@primitive/campaign-domain";

import { createHttpError } from "../utils/http.js";

function mapPageRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    path: row.path,
    next: row.next_id
  };
}

function mapCampaignRow(row, pages) {
  return {
    slug: row.slug,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    pages
  };
}

function assembleCampaigns(campaignRows, pageRows) {
  const pagesByCampaign = new Map();

  for (const row of pageRows) {
    const pages = pagesByCampaign.get(row.campaign_slug) ?? [];
    pages.push(mapPageRow(row));
    pagesByCampaign.set(row.campaign_slug, pages);
  }

  return campaignRows.map((row) => mapCampaignRow(row, pagesByCampaign.get(row.slug) ?? []));
}

function getCampaignRows(database) {
  return database.prepare(`
    SELECT slug, name, start_date, end_date
    FROM campaigns
    ORDER BY start_date ASC, slug ASC
  `).all();
}

function getCampaignPageRows(database) {
  return database.prepare(`
    SELECT id, campaign_slug, type, title, path, next_id, position
    FROM campaign_pages
    ORDER BY campaign_slug ASC, position ASC
  `).all();
}

function getCampaignPageRowsBySlug(database, slug) {
  return database.prepare(`
    SELECT id, campaign_slug, type, title, path, next_id, position
    FROM campaign_pages
    WHERE campaign_slug = ?
    ORDER BY position ASC
  `).all(slug);
}

function getCampaignRowBySlug(database, slug) {
  return database.prepare(`
    SELECT slug, name, start_date, end_date
    FROM campaigns
    WHERE slug = ?
  `).get(slug);
}

function assertValidCampaignCollection(campaigns) {
  const result = validateCampaignCollection(campaigns);

  if (!result.valid) {
    throw new Error(`Campaign data is invalid: ${result.errors.join(" | ")}`);
  }
}

function assertValidStoredCampaign(campaign, slug) {
  const result = validateCampaign(campaign);

  if (!result.valid) {
    throw new Error(`Campaign "${slug}" is invalid: ${result.errors.join(" | ")}`);
  }
}

function assertValidCampaignInput(campaign, campaigns, excludeSlug) {
  const result = validateCampaign(campaign, {
    campaigns,
    excludeSlug
  });

  if (!result.valid) {
    throw createHttpError(400, "Campaign validation failed.", result.errors);
  }
}

function assertSlugAvailable(slug, campaigns, excludeSlug) {
  if (!isCampaignSlugUnique(slug, campaigns, excludeSlug)) {
    throw createHttpError(409, `Campaign slug "${slug}" is already in use.`);
  }
}

function normalizeWriteError(error) {
  const message = error?.message || "";

  if (error?.statusCode) {
    return error;
  }

  if (message.includes("UNIQUE constraint failed: campaigns.slug")) {
    return createHttpError(409, "Campaign slug is already in use.");
  }

  if (message.includes("UNIQUE constraint failed: campaign_pages.id")) {
    return createHttpError(400, "Campaign validation failed.", [
      "Campaign page ids must be globally unique."
    ]);
  }

  return error;
}

function insertCampaignPages(database, campaignSlug, pages) {
  const insertPage = database.prepare(`
    INSERT INTO campaign_pages (id, campaign_slug, type, title, path, next_id, position)
    VALUES (@id, @campaignSlug, @type, @title, @path, NULL, @position)
  `);
  const updatePageNext = database.prepare(`
    UPDATE campaign_pages
    SET next_id = @next
    WHERE id = @id
  `);

  pages.forEach((page, position) => {
    insertPage.run({
      id: page.id,
      campaignSlug,
      type: page.type,
      title: page.title,
      path: page.path,
      position
    });
  });

  pages.forEach((page) => {
    if (page.next) {
      updatePageNext.run({
        id: page.id,
        next: page.next
      });
    }
  });
}

function syncCampaignPages(database, existingPages, campaignSlug, nextPages) {
  const existingIds = new Set(existingPages.map((page) => page.id));
  const nextIds = new Set(nextPages.map((page) => page.id));
  const deletePage = database.prepare(`
    DELETE FROM campaign_pages
    WHERE id = ?
  `);
  const updatePage = database.prepare(`
    UPDATE campaign_pages
    SET campaign_slug = @campaignSlug,
        type = @type,
        title = @title,
        path = @path,
        next_id = NULL,
        position = @position
    WHERE id = @id
  `);
  const insertPage = database.prepare(`
    INSERT INTO campaign_pages (id, campaign_slug, type, title, path, next_id, position)
    VALUES (@id, @campaignSlug, @type, @title, @path, NULL, @position)
  `);
  const updatePageNext = database.prepare(`
    UPDATE campaign_pages
    SET next_id = @next
    WHERE id = @id
  `);

  existingPages.forEach((page) => {
    if (!nextIds.has(page.id)) {
      deletePage.run(page.id);
    }
  });

  nextPages.forEach((page, position) => {
    if (existingIds.has(page.id)) {
      updatePage.run({
        id: page.id,
        campaignSlug,
        type: page.type,
        title: page.title,
        path: page.path,
        position
      });
      return;
    }

    insertPage.run({
      id: page.id,
      campaignSlug,
      type: page.type,
      title: page.title,
      path: page.path,
      position
    });
  });

  nextPages.forEach((page) => {
    if (page.next) {
      updatePageNext.run({
        id: page.id,
        next: page.next
      });
    }
  });
}

export function listCampaigns(database) {
  const campaigns = assembleCampaigns(getCampaignRows(database), getCampaignPageRows(database));
  assertValidCampaignCollection(campaigns);
  return campaigns;
}

export function getCampaignBySlug(database, slug) {
  const campaignRow = getCampaignRowBySlug(database, slug);

  if (!campaignRow) {
    return null;
  }

  const campaign = mapCampaignRow(campaignRow, getCampaignPageRowsBySlug(database, slug).map(mapPageRow));
  assertValidStoredCampaign(campaign, slug);
  return campaign;
}

export function checkCampaignSlugAvailable(database, slug, excludeSlug) {
  if (!String(slug || "").trim()) {
    return false;
  }

  if (excludeSlug && slug === excludeSlug) {
    return true;
  }

  const row = database.prepare(`
    SELECT slug
    FROM campaigns
    WHERE slug = ?
      AND (? IS NULL OR slug != ?)
    LIMIT 1
  `).get(slug, excludeSlug ?? null, excludeSlug ?? null);

  return !row;
}

export function createCampaign(database, campaign) {
  const campaigns = listCampaigns(database);

  assertSlugAvailable(campaign.slug, campaigns);
  assertValidCampaignInput(campaign, campaigns);

  const insertCampaign = database.prepare(`
    INSERT INTO campaigns (slug, name, start_date, end_date)
    VALUES (@slug, @name, @startDate, @endDate)
  `);
  const createTransaction = database.transaction((nextCampaign) => {
    insertCampaign.run({
      slug: nextCampaign.slug,
      name: nextCampaign.name,
      startDate: nextCampaign.startDate,
      endDate: nextCampaign.endDate
    });

    insertCampaignPages(database, nextCampaign.slug, nextCampaign.pages);
  });

  try {
    createTransaction(campaign);
  } catch (error) {
    throw normalizeWriteError(error);
  }

  return getCampaignBySlug(database, campaign.slug);
}

export function updateCampaign(database, originalSlug, campaign) {
  const existingCampaign = getCampaignBySlug(database, originalSlug);

  if (!existingCampaign) {
    throw createHttpError(404, `Campaign "${originalSlug}" was not found.`);
  }

  const campaigns = listCampaigns(database);

  assertSlugAvailable(campaign.slug, campaigns, originalSlug);
  assertValidCampaignInput(campaign, campaigns, originalSlug);

  const existingPages = getCampaignPageRowsBySlug(database, originalSlug);

  const updateCampaignRow = database.prepare(`
    UPDATE campaigns
    SET name = @name,
        start_date = @startDate,
        end_date = @endDate
    WHERE slug = @slug
  `);
  const insertCampaignRow = database.prepare(`
    INSERT INTO campaigns (slug, name, start_date, end_date)
    VALUES (@slug, @name, @startDate, @endDate)
  `);
  const deleteCampaignPages = database.prepare(`
    DELETE FROM campaigns
    WHERE slug = ?
  `);
  const updateSitePageAssignments = database.prepare(`
    UPDATE site_pages
    SET campaign_slug = @nextSlug
    WHERE campaign_slug = @previousSlug
  `);

  const updateTransaction = database.transaction((previousSlug, nextCampaign) => {
    if (previousSlug === nextCampaign.slug) {
      updateCampaignRow.run({
        slug: previousSlug,
        name: nextCampaign.name,
        startDate: nextCampaign.startDate,
        endDate: nextCampaign.endDate
      });
      syncCampaignPages(database, existingPages, previousSlug, nextCampaign.pages);
      return;
    }

    insertCampaignRow.run({
      slug: nextCampaign.slug,
      name: nextCampaign.name,
      startDate: nextCampaign.startDate,
      endDate: nextCampaign.endDate
    });
    syncCampaignPages(database, existingPages, nextCampaign.slug, nextCampaign.pages);
    updateSitePageAssignments.run({
      nextSlug: nextCampaign.slug,
      previousSlug
    });
    deleteCampaignPages.run(previousSlug);
  });

  try {
    updateTransaction(originalSlug, campaign);
  } catch (error) {
    throw normalizeWriteError(error);
  }

  return getCampaignBySlug(database, campaign.slug);
}

export function deleteCampaign(database, slug) {
  const campaign = getCampaignBySlug(database, slug);

  if (!campaign) {
    throw createHttpError(404, `Campaign "${slug}" was not found.`);
  }

  const clearSiteAssignments = database.prepare(`
    UPDATE site_pages
    SET campaign_slug = NULL
    WHERE campaign_slug = ?
  `);
  const deleteCampaignRow = database.prepare(`
    DELETE FROM campaigns
    WHERE slug = ?
  `);
  const deleteTransaction = database.transaction((campaignSlug) => {
    clearSiteAssignments.run(campaignSlug);
    deleteCampaignRow.run(campaignSlug);
  });

  deleteTransaction(slug);
}
