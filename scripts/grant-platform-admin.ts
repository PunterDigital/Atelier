/* Bootstraps the first platform admin, since the System Administration UI
   itself requires already being one - a chicken-and-egg problem no session
   in the app can resolve. Run once per instance after the first real user
   has signed up.

   Run with: pnpm admin:grant <email>  (needs DATABASE_URL)

   Idempotent: granting an already-admin email is a no-op, not an error. */

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { grantPlatformAdmin, isPlatformAdmin } from "@/modules/platform/service";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm admin:grant <email>");
    process.exit(1);
  }

  const db = getDb();
  const [user] = await db
    .select({ id: schema.user.id, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.email, email));
  if (!user) {
    console.error(`No user with email ${email} - they need to sign up first.`);
    process.exit(1);
  }

  if (await isPlatformAdmin(db, user.id)) {
    console.log(`${user.name} <${email}> is already a platform admin.`);
    return;
  }

  await grantPlatformAdmin(db, user.id, null);
  console.log(`Granted platform admin to ${user.name} <${email}>.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Grant failed:", error);
    process.exit(1);
  });
