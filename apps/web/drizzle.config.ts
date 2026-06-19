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

// Parse the DATABASE_URL into parts so we can pass ssl explicitly.
// Local non-SSL servers need ssl: false to avoid hangs; remote servers (Neon, etc.) need ssl: true.
function parseDbUrl(url: string) {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  const ssl = sslmode === "disable" ? false : sslmode ? true : u.hostname !== "localhost";
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ""),
    ssl,
  };
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: parseDbUrl(process.env.DATABASE_URL ?? "postgresql://primitive:primitive@localhost:5432/primitive"),
});
