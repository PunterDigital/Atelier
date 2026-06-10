import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema";

// Driver-agnostic database type: production uses node-postgres, the
// integration test suite uses PGlite (real Postgres in-process). Module
// services accept this so both satisfy them.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: NodePgDatabase<typeof schema> | undefined;

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
