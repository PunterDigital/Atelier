import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let db: Db | undefined;

// Lazy on purpose: the production build and DB-free test suites must work
// without a DATABASE_URL. Anything that actually touches the database goes
// through getDb() and fails loud if the env is missing.
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres instance.",
      );
    }
    db = drizzle(url, { schema });
  }
  return db;
}

export { schema };
