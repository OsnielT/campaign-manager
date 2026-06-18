export const SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS campaigns (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS campaign_pages (
      id TEXT PRIMARY KEY,
      campaign_slug TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      path TEXT NOT NULL,
      next_id TEXT,
      position INTEGER NOT NULL,
      FOREIGN KEY (campaign_slug) REFERENCES campaigns(slug) ON DELETE CASCADE,
      FOREIGN KEY (next_id) REFERENCES campaign_pages(id) ON DELETE SET NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS campaign_page_compositions (
      campaign_page_id TEXT PRIMARY KEY,
      tree_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (campaign_page_id) REFERENCES campaign_pages(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS site (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      base_path TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS site_pages (
      id TEXT PRIMARY KEY,
      site_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      campaign_slug TEXT,
      FOREIGN KEY (site_id) REFERENCES site(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_slug) REFERENCES campaigns(slug) ON DELETE SET NULL
    )
  `
];

export function createSchema(database) {
  for (const statement of SCHEMA_STATEMENTS) {
    database.prepare(statement).run();
  }
}
