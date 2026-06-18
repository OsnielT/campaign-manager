import { defineConfig } from "drizzle-kit";
import * as fs from "fs";

// drizzle-kit doesn't load Next.js .env.local files — parse it manually
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      const m = line.match(/^([^#\s][^=]*)=(.*)$/);
      if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
    }
    break;
  }
}

// Parse the DATABASE_URL into parts so we can pass ssl: false explicitly.
// The postgres driver may hang when using a URL string on local non-SSL servers.
function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ""),
    ssl: false,
  };
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: parseDbUrl(process.env.DATABASE_URL ?? "postgresql://primitive:primitive@localhost:5432/primitive"),
});
