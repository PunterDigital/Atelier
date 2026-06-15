/* Rich demo seed for the "Acme Inc" business: a heavily populated workspace
   for screenshots and walkthroughs. Lots of clients (some archived),
   projects, tasks, several weeks of tracked time, expenses, and a full
   spread of invoices across every status and tax treatment.

   Run with: pnpm seed:acme  (needs DATABASE_URL; docker compose provides it)

   Like db/seed.ts it goes through the real module services and the real
   Better Auth sign-up, so a broken product breaks the seed loudly.
   Idempotent: a second run is a no-op (keyed on the owner email). */

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";
import { logManualEntry } from "@/modules/time/service";
import { createExpense } from "@/modules/expenses/service";
import { createDraftInvoice, issueInvoice } from "@/modules/billing/invoices";
import { addManualLine } from "@/modules/billing/generate";
import { markInvoicePaid } from "@/modules/billing/lifecycle";
import { getAuth } from "@/server/auth";
import { addDays, startOfWeek } from "@/lib/week";

export const ACME_EMAIL = "owner@acme.test";
export const ACME_PASSWORD = "acme-demo-1234";

const CURRENCY = "USD";
const STANDARD_RATE = "8.875"; // headline sales-tax rate shown on standard invoices

// Deterministic, repo-friendly variation (no Math.random, so reruns match).
const jitter = (i: number, span: number, base: number) =>
  base + (i * 37) % span;

type Row = { id: string };

async function main() {
  const db = getDb();

  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, ACME_EMAIL));
  if (existing.length > 0) {
    console.log(`Acme seed already applied (${ACME_EMAIL} exists) - nothing to do.`);
    return;
  }

  // Real sign-up so the password hash matches the auth config.
  await getAuth().api.signUpEmail({
    body: { name: "Avery Stone", email: ACME_EMAIL, password: ACME_PASSWORD },
  });
  const [user] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, ACME_EMAIL));

  const [business] = await db
    .insert(schema.business)
    .values({
      name: "Acme Inc",
      address: "1 Roadrunner Plaza\nSuite 1200\nFairfield, NJ 07004",
      currency: CURRENCY,
      taxConfig: { standardRatePct: STANDARD_RATE, vatNumber: "US-ACME-0001" },
    })
    .returning();
  await db.insert(schema.businessMember).values({
    businessId: business.id,
    userId: user.id,
    role: "owner",
  });
  const biz = business.id;

  // --- Clients -------------------------------------------------------------
  // rateMinor is USD cents/hour. A couple carry a VAT number so we can issue
  // reverse-charge invoices; two get archived to show that state.
  const clientSpecs: {
    name: string;
    company: string;
    contact: { name: string; email: string; role: string };
    rate: number;
    vatNumber?: string;
    notes?: string;
    archived?: boolean;
  }[] = [
    { name: "Globex Corporation", company: "Globex Corporation", contact: { name: "Hank Scorpio", email: "hank@globex.test", role: "VP Operations" }, rate: 18500, vatNumber: "GB123456789", notes: "Retainer renews each January. Prefers a monthly summary." },
    { name: "Initech", company: "Initech LLC", contact: { name: "Bill Lumbergh", email: "bill@initech.test", role: "Division Manager" }, rate: 16000, notes: "Needs cover sheets on every report." },
    { name: "Soylent Industries", company: "Soylent Industries", contact: { name: "Dana Cole", email: "dana@soylent.test", role: "Head of Product" }, rate: 21000 },
    { name: "Umbrella Health", company: "Umbrella Health Group", contact: { name: "Rana Okafor", email: "rana@umbrella.test", role: "CTO" }, rate: 22500, vatNumber: "DE811234567", notes: "Security review required before each release." },
    { name: "Stark Solutions", company: "Stark Solutions Ltd", contact: { name: "Pepper Vance", email: "pepper@stark.test", role: "COO" }, rate: 24000, notes: "Fast payer. Loves a tidy changelog." },
    { name: "Wayne Enterprises", company: "Wayne Enterprises", contact: { name: "Lucius Reed", email: "lucius@wayne.test", role: "R&D Director" }, rate: 20000 },
    { name: "Hooli", company: "Hooli Inc", contact: { name: "Gavin Park", email: "gavin@hooli.test", role: "Platform Lead" }, rate: 17500 },
    { name: "Pied Piper", company: "Pied Piper", contact: { name: "Richard Bell", email: "richard@piedpiper.test", role: "Founder" }, rate: 14000, notes: "Early-stage. Watching budget closely." },
    { name: "Cyberdyne Systems", company: "Cyberdyne Systems", contact: { name: "Miles Tran", email: "miles@cyberdyne.test", role: "Engineering" }, rate: 19000, notes: "Engagement wrapped Q1.", archived: true },
    { name: "Vandelay Imports", company: "Vandelay Imports", contact: { name: "Art Vandelay", email: "art@vandelay.test", role: "Owner" }, rate: 12500, notes: "One-off site. Closed out.", archived: true },
  ];

  const clients: (Row & { name: string; rate: number; archived?: boolean })[] = [];
  for (const c of clientSpecs) {
    const created = (await createClient(db, biz, user.id, {
      name: c.name,
      company: c.company,
      contacts: [c.contact],
      notes: c.notes,
      vatNumber: c.vatNumber ?? null,
      defaultRateMinor: c.rate,
      defaultRateCurrency: CURRENCY,
    })) as Row;
    clients.push({ id: created.id, name: c.name, rate: c.rate, archived: c.archived });
  }
  // Archive the two closed-out clients directly (no soft-delete service helper
  // is needed for a seed).
  for (const c of clients.filter((x) => x.archived)) {
    await db
      .update(schema.client)
      .set({ archivedAt: new Date() })
      .where(eq(schema.client.id, c.id));
  }
  const activeClients = clients.filter((c) => !c.archived);

  // --- Projects ------------------------------------------------------------
  const projectNames = [
    "Website rebuild", "Mobile app v2", "Design system", "Data warehouse",
    "Billing migration", "Marketing site", "Internal dashboard", "API platform",
    "Onboarding revamp", "Search relevance", "Checkout flow", "Analytics pipeline",
    "Brand refresh", "Customer portal", "Performance audit", "Infra hardening",
    "Reporting suite", "Notification service",
  ];
  const statuses = ["active", "active", "active", "on_hold", "completed"] as const;
  const monday = startOfWeek(new Date());

  const projects: (Row & { clientId: string; rate: number })[] = [];
  let pn = 0;
  for (const client of activeClients) {
    const count = 2 + (pn % 2); // 2 or 3 projects each
    for (let k = 0; k < count; k++) {
      const status = statuses[(pn + k) % statuses.length];
      const created = (await createProject(db, biz, user.id, {
        name: `${projectNames[pn % projectNames.length]}`,
        clientId: client.id,
        status,
        dueDate: status === "completed" ? null : addDays(monday, jitter(pn, 40, 10)),
      })) as Row;
      projects.push({ id: created.id, clientId: client.id, rate: client.rate });
      pn++;
    }
  }

  // --- Tasks ---------------------------------------------------------------
  const taskTitles = [
    "Discovery & scoping", "Information architecture", "Wireframes",
    "Design system tokens", "Component library", "Homepage build",
    "Auth & accounts", "API integration", "Data migration", "QA pass",
    "Performance tuning", "Accessibility audit", "Launch checklist",
    "Stakeholder review", "Bug triage", "Documentation",
  ];
  const taskStatuses = ["done", "done", "in_review", "in_progress", "in_progress", "todo"] as const;

  const tasks: (Row & { projectId: string; rate: number })[] = [];
  let tn = 0;
  for (const project of projects) {
    const count = 3 + (tn % 3); // 3..5 tasks each
    for (let k = 0; k < count; k++) {
      const created = (await createTask(db, biz, project.id, {
        title: taskTitles[(tn + k) % taskTitles.length],
        status: taskStatuses[(tn + k) % taskStatuses.length],
        estimateMinutes: 60 * (2 + ((tn + k) % 8)),
      })) as Row;
      tasks.push({ id: created.id, projectId: project.id, rate: project.rate });
      tn++;
    }
  }

  // --- Time entries: several weeks of believable tracked work --------------
  const hours = (n: number) => Math.round(n * 3600);
  const at = (weekOffset: number, day: number, hour: number) => {
    const d = addDays(monday, weekOffset * 7 + day);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const noteBank = [
    "Pairing session", "Client call follow-ups", "Implementation", "Review feedback",
    "Spec + estimates", "Bug fixes", "Polish pass", undefined, undefined,
  ];
  let entryCount = 0;
  // Six weeks back through the current week.
  for (let w = -5; w <= 0; w++) {
    // Spread work across a rotating slice of tasks each week.
    for (let d = 0; d < 5; d++) {
      const task = tasks[(entryCount * 3 + d + (w + 5) * 7) % tasks.length];
      const morning = 0.75 + ((entryCount + d) % 4) * 0.75; // 0.75..3.0h
      await logManualEntry(db, biz, user.id, {
        taskId: task.id,
        startedAt: at(w, d, 9),
        durationSeconds: hours(morning),
        note: noteBank[(entryCount + d) % noteBank.length],
        billable: true,
      });
      entryCount++;
      // Some afternoons get a second block.
      if ((entryCount + d) % 2 === 0) {
        const task2 = tasks[(entryCount * 5 + (w + 5) * 3) % tasks.length];
        await logManualEntry(db, biz, user.id, {
          taskId: task2.id,
          startedAt: at(w, d, 14),
          durationSeconds: hours(1 + ((entryCount + d) % 3)),
          note: noteBank[(entryCount + d + 2) % noteBank.length],
          billable: (entryCount + d) % 5 !== 0, // a few non-billable blocks
        });
        entryCount++;
      }
    }
  }

  // --- Expenses ------------------------------------------------------------
  const monthsAgo = (m: number, day: number) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - m, day);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  };
  const expenseSpecs: {
    description: string; amount: number; vendor: string; category: string; m: number; day: number; paid?: boolean; notes?: string;
  }[] = [
    { description: "Figma annual seats (3)", amount: 45000, vendor: "Figma", category: "Software", m: 5, day: 4, paid: true },
    { description: "GitHub Team", amount: 4400, vendor: "GitHub", category: "Software", m: 5, day: 9, paid: true },
    { description: "Vercel Pro", amount: 2000, vendor: "Vercel", category: "Hosting", m: 4, day: 1, paid: true },
    { description: "AWS - production", amount: 38215, vendor: "Amazon Web Services", category: "Hosting", m: 4, day: 3, paid: true },
    { description: "Client lunch - Stark Solutions", amount: 8650, vendor: "The Ironworks", category: "Meals", m: 4, day: 18, paid: true, notes: "Kickoff lunch" },
    { description: "Standing desk", amount: 52900, vendor: "Fully", category: "Equipment", m: 3, day: 7, paid: true },
    { description: "Conference ticket - SaaSConf", amount: 79900, vendor: "SaaSConf", category: "Travel", m: 3, day: 12 },
    { description: "Flights - SaaSConf", amount: 41230, vendor: "United Airlines", category: "Travel", m: 3, day: 12, paid: true },
    { description: "Hotel - 3 nights", amount: 62400, vendor: "Marriott", category: "Travel", m: 3, day: 14, paid: true },
    { description: "1Password Teams", amount: 7960, vendor: "1Password", category: "Software", m: 3, day: 2, paid: true },
    { description: "Notion Plus", amount: 1600, vendor: "Notion", category: "Software", m: 2, day: 5, paid: true },
    { description: "Sentry Team", amount: 8000, vendor: "Sentry", category: "Software", m: 2, day: 6 },
    { description: "Domain renewals (12)", amount: 21800, vendor: "Cloudflare", category: "Software", m: 2, day: 9, paid: true },
    { description: "Accountant - quarterly", amount: 120000, vendor: "Beancount LLP", category: "Professional services", m: 2, day: 20, paid: true },
    { description: "Stock photography", amount: 4900, vendor: "Unsplash+", category: "Software", m: 1, day: 3, paid: true },
    { description: "Coworking day passes", amount: 13500, vendor: "WeWork", category: "Office", m: 1, day: 11 },
    { description: "USB-C dock", amount: 18999, vendor: "CalDigit", category: "Equipment", m: 1, day: 15, paid: true },
    { description: "Linear Standard", amount: 4800, vendor: "Linear", category: "Software", m: 1, day: 22 },
    { description: "AWS - production", amount: 41080, vendor: "Amazon Web Services", category: "Hosting", m: 0, day: 3 },
    { description: "Vercel Pro", amount: 2000, vendor: "Vercel", category: "Hosting", m: 0, day: 1, paid: true },
    { description: "Client dinner - Umbrella Health", amount: 14210, vendor: "Casa Verde", category: "Meals", m: 0, day: 8 },
    { description: "Postmark email", amount: 1500, vendor: "Postmark", category: "Software", m: 0, day: 6, paid: true },
    { description: "Office snacks & coffee", amount: 6740, vendor: "Costco", category: "Office", m: 0, day: 10, paid: true },
    { description: "Apple Developer Program", amount: 9900, vendor: "Apple", category: "Software", m: 0, day: 12 },
  ];
  let paidExpenses = 0;
  for (const e of expenseSpecs) {
    const created = await createExpense(db, biz, {
      description: e.description,
      amountMinor: e.amount,
      currency: CURRENCY,
      vendor: e.vendor,
      category: e.category,
      incurredAt: monthsAgo(e.m, e.day),
      notes: e.notes ?? null,
    });
    if (e.paid && created) {
      await db
        .update(schema.expense)
        .set({ status: "paid", paidAt: monthsAgo(e.m, e.day + 2) })
        .where(eq(schema.expense.id, created.id));
      paidExpenses++;
    }
  }

  // --- Invoices: every status and treatment --------------------------------
  type Treatment = "standard" | "zero_rated" | "reverse_charge";
  type Plan = {
    clientName: string;
    treatment: Treatment;
    lines: { description: string; amount: string }[];
    state: "draft" | "sent" | "paid" | "overdue";
    issueMonthsAgo?: number;
    dueInDays?: number; // relative to issue; negative => already past
  };
  const byName = (n: string) => activeClients.find((c) => c.name === n)!;
  const invoicePlans: Plan[] = [
    { clientName: "Stark Solutions", treatment: "standard", state: "paid", issueMonthsAgo: 3, dueInDays: 14,
      lines: [{ description: "Design system - sprint 1", amount: "9600.00" }, { description: "Component library", amount: "5400.00" }] },
    { clientName: "Globex Corporation", treatment: "reverse_charge", state: "paid", issueMonthsAgo: 2, dueInDays: 30,
      lines: [{ description: "Retainer - January", amount: "12000.00" }] },
    { clientName: "Umbrella Health", treatment: "standard", state: "paid", issueMonthsAgo: 2, dueInDays: 14,
      lines: [{ description: "Security review", amount: "7800.00" }, { description: "Remediation support", amount: "3200.00" }] },
    { clientName: "Soylent Industries", treatment: "standard", state: "overdue", issueMonthsAgo: 2, dueInDays: 14,
      lines: [{ description: "Data warehouse - phase 1", amount: "16800.00" }] },
    { clientName: "Hooli", treatment: "zero_rated", state: "overdue", issueMonthsAgo: 1, dueInDays: 21,
      lines: [{ description: "Platform consulting", amount: "11250.00" }] },
    { clientName: "Wayne Enterprises", treatment: "standard", state: "sent", issueMonthsAgo: 1, dueInDays: 30,
      lines: [{ description: "API platform - milestone 2", amount: "14000.00" }, { description: "Documentation", amount: "2000.00" }] },
    { clientName: "Stark Solutions", treatment: "standard", state: "sent", issueMonthsAgo: 0, dueInDays: 14,
      lines: [{ description: "Design system - sprint 2", amount: "9600.00" }] },
    { clientName: "Globex Corporation", treatment: "reverse_charge", state: "sent", issueMonthsAgo: 0, dueInDays: 30,
      lines: [{ description: "Retainer - current month", amount: "12000.00" }] },
    { clientName: "Pied Piper", treatment: "standard", state: "draft",
      lines: [{ description: "Search relevance - discovery", amount: "5600.00" }] },
    { clientName: "Umbrella Health", treatment: "standard", state: "draft",
      lines: [{ description: "Customer portal - estimate", amount: "18400.00" }, { description: "Accessibility audit", amount: "2400.00" }] },
    { clientName: "Initech", treatment: "standard", state: "paid", issueMonthsAgo: 4, dueInDays: 14,
      lines: [{ description: "Internal dashboard", amount: "8800.00" }] },
    { clientName: "Soylent Industries", treatment: "standard", state: "sent", issueMonthsAgo: 0, dueInDays: 21,
      lines: [{ description: "Analytics pipeline - phase 1", amount: "13200.00" }] },
  ];

  const counts = { draft: 0, sent: 0, paid: 0, overdue: 0 };
  for (const plan of invoicePlans) {
    const client = byName(plan.clientName);
    const issueDate = plan.issueMonthsAgo === undefined ? new Date() : monthsAgo(plan.issueMonthsAgo, 5);
    const dueDate =
      plan.dueInDays === undefined ? null : new Date(issueDate.getTime() + plan.dueInDays * 86400000);

    const draft = (await createDraftInvoice(db, biz, {
      clientId: client.id,
      currency: CURRENCY,
      taxTreatment: plan.treatment,
      standardRatePercent: plan.treatment === "standard" ? STANDARD_RATE : undefined,
      dueDate,
      notes: null,
    })) as Row | null;
    if (!draft) {
      throw new Error(`Failed to create draft invoice for ${plan.clientName}`);
    }
    for (const line of plan.lines) {
      await addManualLine(db, biz, {
        invoiceId: draft.id,
        description: line.description,
        amountMajor: line.amount,
      });
    }

    if (plan.state === "draft") {
      counts.draft++;
      continue;
    }

    const issued = await issueInvoice(db, biz, draft.id, issueDate);
    if (!issued.ok) {
      throw new Error(`Failed to issue invoice for ${plan.clientName}: ${issued.reason}`);
    }
    if (plan.state === "sent") {
      counts.sent++;
    } else if (plan.state === "paid") {
      await markInvoicePaid(db, biz, draft.id);
      counts.paid++;
    } else if (plan.state === "overdue") {
      // Issue leaves it "sent"; flip to overdue (its due date is already past).
      await db
        .update(schema.invoice)
        .set({ status: "overdue" })
        .where(eq(schema.invoice.id, draft.id));
      counts.overdue++;
    }
  }

  console.log("Seeded Acme Inc demo data:");
  console.log(`  business: ${business.name} (${CURRENCY})`);
  console.log(`  clients: ${clients.length} (${clients.length - activeClients.length} archived)`);
  console.log(`  projects: ${projects.length}, tasks: ${tasks.length}, time entries: ${entryCount}`);
  console.log(`  expenses: ${expenseSpecs.length} (${paidExpenses} paid)`);
  console.log(`  invoices: ${invoicePlans.length} - ${counts.draft} draft, ${counts.sent} sent, ${counts.paid} paid, ${counts.overdue} overdue`);
  console.log(`  sign in: ${ACME_EMAIL} / ${ACME_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Acme seed failed:", error);
    process.exit(1);
  });
