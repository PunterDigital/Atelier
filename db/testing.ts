// Test-only database helper. Not imported by anything that ships.
//
// Booting PGlite from nothing runs Postgres' initdb, which costs around
// three seconds and used to happen once per test file that needs a database
// - more than twenty of them. Restoring a prepared data directory instead
// costs about half a second and arrives with the schema already migrated, so
// the migration step is skipped too.
//
// The prepared directory is built once per run and cached on disk, keyed by
// a fingerprint of the migrations it was built from: change a migration and
// the key changes with it, so the cache cannot serve a stale schema.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { schema, type Db } from "@/db";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));
const cacheDir = fileURLToPath(
  new URL("../node_modules/.cache/clerq", import.meta.url),
);

// Every file under db/migrations, contents included - the .sql files and the
// journal drizzle reads to order them.
async function migrationsFingerprint(): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (dir: string): Promise<void> => {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else {
        hash.update(path);
        hash.update(await readFile(path));
      }
    }
  };
  await walk(migrationsFolder);
  return hash.digest("hex").slice(0, 16);
}

let prepared: Promise<ArrayBuffer> | undefined;

async function buildPreparedDataDir(): Promise<ArrayBuffer> {
  const cachePath = join(cacheDir, `pglite-${await migrationsFingerprint()}.tar`);
  if (existsSync(cachePath)) {
    const cached = await readFile(cachePath);
    return cached.buffer.slice(
      cached.byteOffset,
      cached.byteOffset + cached.byteLength,
    ) as ArrayBuffer;
  }

  const pglite = new PGlite();
  await migrate(drizzle(pglite, { schema }), { migrationsFolder });
  const dump = await pglite.dumpDataDir("none");
  await pglite.close();
  const bytes = await dump.arrayBuffer();

  await mkdir(cacheDir, { recursive: true });
  // Written under a unique name and renamed into place: test files run in
  // parallel workers and can race to build this, and a rename is atomic, so
  // no reader ever sees a half-written file.
  const partial = `${cachePath}.${process.pid}.partial`;
  await writeFile(partial, new Uint8Array(bytes));
  await rename(partial, cachePath);
  return bytes;
}

// A migrated, empty database. Each call gets its own instance, so test files
// stay isolated from one another exactly as they were before.
export async function createTestDatabase(): Promise<{
  db: Db;
  pglite: PGlite;
}> {
  prepared ??= buildPreparedDataDir();
  const pglite = new PGlite({ loadDataDir: new Blob([await prepared]) });
  await pglite.waitReady;
  return { pglite, db: drizzle(pglite, { schema }) };
}
