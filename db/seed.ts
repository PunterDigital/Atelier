/* Demo seed: one business, clients, projects, tasks, and a week of time
   entries, so a fresh instance (and the public demo) shows the product
   instead of empty states. Idempotent: a second run is a no-op.

   Run with: pnpm db:seed (needs DATABASE_URL; docker compose provides it)

   It goes through the real module services and the real Better Auth
   sign-up, so the seed breaks loudly if the product logic does - a
   broken seed is broken onboarding. */

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";
import { logManualEntry } from "@/modules/time/service";
import { getAuth } from "@/server/auth";
import { addDays, startOfWeek } from "@/lib/week";

export const DEMO_EMAIL = "demo@atelier.local";
export const DEMO_PASSWORD = "atelier-demo";

async function main() {
  const db = getDb();

  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, DEMO_EMAIL));
  if (existing.length > 0) {
    console.log(`Seed already applied (${DEMO_EMAIL} exists) - nothing to do.`);
    return;
  }

  // Real sign-up so the password hash matches the auth config.
  await getAuth().api.signUpEmail({
    body: { name: "Demo Maker", email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  const [user] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, DEMO_EMAIL));

  const [business] = await db
    .insert(schema.business)
    .values({ name: "Studio Demo", currency: "EUR" })
    .returning();
  await db.insert(schema.businessMember).values({
    businessId: business.id,
    userId: user.id,
    role: "owner",
  });

  const northwind = await createClient(db, business.id, user.id, {
    name: "Northwind Studio",
    company: "Northwind Studio s.r.o.",
    contacts: [{ name: "Petra Svobodova", email: "petra@northwind.test", role: "Founder" }],
    notes: "Referred by a former colleague - prefers async updates",
    defaultRateMinor: 6200,
    defaultRateCurrency: "EUR",
  });
  const lumen = await createClient(db, business.id, user.id, {
    name: "Lumen Labs",
    company: "Lumen Labs Ltd",
    contacts: [{ name: "Owen Hart", email: "owen@lumenlabs.test", role: "CTO" }],
    defaultRateMinor: 7500,
    defaultRateCurrency: "GBP",
  });

  const website = (await createProject(db, business.id, user.id, {
    name: "Website rebuild",
    clientId: northwind.id,
    status: "active",
    dueDate: addDays(startOfWeek(new Date()), 25),
  })) as { id: string };
  const api = (await createProject(db, business.id, user.id, {
    name: "Billing API integration",
    clientId: lumen.id,
    status: "active",
    defaultRateMinor: 8000,
    defaultRateCurrency: "GBP",
  })) as { id: string };

  const taskTitles: {
    projectId: string;
    title: string;
    status: "todo" | "in_progress" | "in_review" | "done";
    estimateMinutes?: number;
  }[] = [
    { projectId: website.id, title: "Information architecture", status: "done", estimateMinutes: 240 },
    { projectId: website.id, title: "Design system tokens", status: "in_review", estimateMinutes: 180 },
    { projectId: website.id, title: "Homepage build", status: "in_progress", estimateMinutes: 480 },
    { projectId: website.id, title: "CMS migration", status: "todo" },
    { projectId: api.id, title: "Webhook receiver", status: "in_progress", estimateMinutes: 360 },
    { projectId: api.id, title: "Rate limit handling", status: "todo", estimateMinutes: 120 },
  ];
  const tasks: { id: string }[] = [];
  for (const t of taskTitles) {
    tasks.push(
      (await createTask(db, business.id, t.projectId, {
        title: t.title,
        status: t.status,
        estimateMinutes: t.estimateMinutes ?? null,
      })) as { id: string },
    );
  }

  // A believable week of tracked time, relative to now so the timesheet
  // demo always has content.
  const monday = startOfWeek(new Date());
  const hours = (n: number) => Math.round(n * 3600);
  const at = (day: number, hour: number) => {
    const d = addDays(monday, day);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const entries = [
    { taskId: tasks[0].id, startedAt: at(0, 9), durationSeconds: hours(2.5), note: "IA workshop prep" },
    { taskId: tasks[2].id, startedAt: at(0, 13), durationSeconds: hours(3) },
    { taskId: tasks[2].id, startedAt: at(1, 9), durationSeconds: hours(4.25), note: "Hero + nav" },
    { taskId: tasks[4].id, startedAt: at(1, 14), durationSeconds: hours(2) },
    { taskId: tasks[1].id, startedAt: at(2, 10), durationSeconds: hours(1.5) },
    { taskId: tasks[4].id, startedAt: at(2, 13), durationSeconds: hours(3.5), note: "Signature verification" },
  ];
  for (const entry of entries) {
    await logManualEntry(db, business.id, user.id, {
      ...entry,
      billable: true,
    });
  }

  console.log("Seeded demo data:");
  console.log(`  business: ${business.name} (EUR)`);
  console.log("  2 clients, 2 projects, 6 tasks, 6 time entries this week");
  console.log(`  sign in: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
