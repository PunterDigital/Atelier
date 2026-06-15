/* Runtime database migrator for the production image.

   Applies any pending Drizzle migrations, then exits. The container
   entrypoint runs this before starting the server, so a single image
   self-migrates on boot - there is no separate migrate step to orchestrate,
   which is what lets Clerq deploy on single-container platforms (EasyPanel,
   Coolify, Railway) as well as docker-compose.

   It reuses Drizzle's official migrator, so the __drizzle_migrations__
   bookkeeping is identical to the `drizzle-kit migrate` used in dev and CI -
   the two never disagree about what has been applied.

   This is bundled to a standalone migrate.mjs at image build time
   (`pnpm build:migrator`, see the Dockerfile), so it must stay
   dependency-light: drizzle-orm is inlined by the bundler, and pg is the only
   runtime dependency - already present in the Next.js standalone output.

   Set CLERQ_SKIP_MIGRATIONS to skip it entirely (advanced operators who apply
   migrations out of band). */

import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  if (process.env.CLERQ_SKIP_MIGRATIONS) {
    console.log("CLERQ_SKIP_MIGRATIONS is set - skipping database migrations.");
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; cannot run database migrations.");
  }

  // The migrations ship alongside this script in the image, at
  // /app/db/migrations. Resolving from import.meta.url keeps it correct
  // wherever the bundled file lives.
  const migrationsFolder = fileURLToPath(
    new URL("./db/migrations", import.meta.url),
  );

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log("Database migrations are up to date.");
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
