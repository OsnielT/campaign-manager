import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// In Next.js, prevent multiple connections in development due to HMR
const globalForDb = globalThis as unknown as { pgClient: postgres.Sql | undefined };

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
