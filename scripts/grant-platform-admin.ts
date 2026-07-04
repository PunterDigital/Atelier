/* Bootstraps the first platform admin, since the System Administration UI
   itself requires already being one - a chicken-and-egg problem no session
   in the app can resolve. Run once per instance after the first real user
   has signed up.

   Two ways to run it, depending on where you are:

   - Self-hosted (docker compose): the production image bundles this to a
     dependency-light grant-admin.mjs (`pnpm build:grant-admin`, see the
     Dockerfile - the same pattern as migrate.mjs), so run it inside the
     already-running container:
         docker compose exec app node grant-admin.mjs <email>

   - From a source checkout (contributors): run it through tsx:
         pnpm admin:grant <email>

   Both need DATABASE_URL pointing at the instance's Postgres. Because it is
   bundled into the production image, this script stays dependency-light: it
   talks to Postgres through `pg` directly (already in the Next.js standalone
   output) rather than importing the app's Drizzle layer, exactly as the
   runtime migrator does.

   Idempotent: granting an already-admin email is a no-op, not an error. */

import { Pool } from "pg";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error(
      "Usage: node grant-admin.mjs <email>   (or, from source: pnpm admin:grant <email>)",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; cannot grant platform admin.");
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query<{ id: string; name: string }>(
      'select id, name from "user" where email = $1',
      [email],
    );
    const user = rows[0];
    if (!user) {
      console.error(`No user with email ${email} - they need to sign up first.`);
      await pool.end();
      process.exit(1);
    }

    // ON CONFLICT DO NOTHING makes re-granting a no-op; the RETURNING row
    // tells us whether this call actually inserted, so the two cases report
    // honestly. granted_by_user_id is null: the bootstrap admin predates any
    // admin session that could be the actor.
    const inserted = await pool.query(
      `insert into platform_admin (user_id, granted_by_user_id)
         values ($1, null)
         on conflict (user_id) do nothing
         returning user_id`,
      [user.id],
    );
    if (inserted.rowCount === 0) {
      console.log(`${user.name} <${email}> is already a platform admin.`);
    } else {
      console.log(`Granted platform admin to ${user.name} <${email}>.`);
    }
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Grant failed:", error);
    process.exit(1);
  });
