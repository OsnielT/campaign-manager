import { validateCampaign, validateSite } from "@primitive/campaign-domain";

import { campaignSeed } from "./data/campaign-seed.js";
import { siteSeed } from "./data/site-seed.js";

function campaignsTableIsEmpty(database) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM campaigns").get();
  return row.count === 0;
}

function siteTableIsEmpty(database) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM site").get();
  return row.count === 0;
}

function seedCampaigns(database) {
  const insertCampaign = database.prepare(`
    INSERT INTO campaigns (slug, name, start_date, end_date)
    VALUES (@slug, @name, @startDate, @endDate)
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
  const insertMany = database.transaction((campaigns) => {
    for (const campaign of campaigns) {
      const result = validateCampaign(campaign, {
        campaigns,
        excludeSlug: campaign.slug
      });

      if (!result.valid) {
        throw new Error(`Cannot seed campaign "${campaign.slug}": ${result.errors.join(" | ")}`);
      }

      insertCampaign.run({
        slug: campaign.slug,
        name: campaign.name,
        startDate: campaign.startDate,
        endDate: campaign.endDate
      });

      campaign.pages.forEach((page, position) => {
        insertPage.run({
          id: page.id,
          campaignSlug: campaign.slug,
          type: page.type,
          title: page.title,
          path: page.path,
          position
        });
      });

      campaign.pages.forEach((page) => {
        if (page.next) {
          updatePageNext.run({
            id: page.id,
            next: page.next
          });
        }
      });
    }
  });

  insertMany(campaignSeed);
}

function seedSite(database) {
  const result = validateSite(siteSeed, { campaigns: campaignSeed });

  if (!result.valid) {
    throw new Error(`Cannot seed site: ${result.errors.join(" | ")}`);
  }

  const insertSite = database.prepare(`
    INSERT INTO site (id, name, base_path)
    VALUES (1, @name, @basePath)
  `);
  const insertPage = database.prepare(`
    INSERT INTO site_pages (id, site_id, title, path, type, campaign_slug)
    VALUES (@id, 1, @title, @path, @type, @campaignSlug)
  `);
  const insertAll = database.transaction((site) => {
    insertSite.run({
      name: site.name,
      basePath: site.basePath
    });

    for (const page of site.pages) {
      insertPage.run({
        id: page.id,
        title: page.title,
        path: page.path,
        type: page.type,
        campaignSlug: page.campaignSlug
      });
    }
  });

  insertAll(siteSeed);
}

export function seedDatabase(database) {
  if (campaignsTableIsEmpty(database)) {
    seedCampaigns(database);
  }

  if (siteTableIsEmpty(database)) {
    seedSite(database);
  }
}
