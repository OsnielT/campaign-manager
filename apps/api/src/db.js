import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { createSchema } from "./schema.js";
import { seedDatabase } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.resolve(__dirname, "../data");
const databasePath = path.join(dataDirectory, "primitive.db");

let databaseInstance = null;

function bootstrapDatabase() {
  fs.mkdirSync(dataDirectory, { recursive: true });

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  createSchema(database);
  seedDatabase(database);

  return database;
}

export function getDatabase() {
  if (!databaseInstance) {
    databaseInstance = bootstrapDatabase();
  }

  return databaseInstance;
}

export { databasePath };
