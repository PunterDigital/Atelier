import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";

import {
  createProject,
  getProject,
  listProjects,
  updateProject,
} from "./service";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;

let businessA: { id: string };
let businessB: { id: string };
let clientA: { id: string };
let clientB: { id: string };
const userA = "user-a";
const userB = "user-b";

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [businessA] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "GBP" })
    .returning();
  [businessB] = await db
    .insert(schema.business)
    .values({ name: "Beta Works", currency: "CZK" })
    .returning();
  await db.insert(schema.user).values([
    { id: userA, name: "Ada", email: "ada@alpha.test" },
    { id: userB, name: "Ben", email: "ben@beta.test" },
  ]);
  clientA = await createClient(db, businessA.id, userA, {
    name: "Alpha client",
    contacts: [],
  });
  clientB = await createClient(db, businessB.id, userB, {
    name: "Beta client",
    contacts: [],
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("projects service - cross-business isolation", () => {
  it("refuses to link a project to another business's client", async () => {
    expect(
      await createProject(db, businessA.id, userA, {
        name: "Intrusion",
        clientId: clientB.id,
        status: "active",
      }),
    ).toBeNull();
  });

  it("denies reads and writes on another business's project", async () => {
    const target = await createProject(db, businessB.id, userB, {
      name: "Beta internal",
      clientId: clientB.id,
      status: "active",
    });
    expect(target).not.toBeNull();
    const targetId = (target as { id: string }).id;

    expect(await getProject(db, businessA.id, targetId)).toBeNull();
    expect(
      await updateProject(db, businessA.id, targetId, {
        name: "hijacked",
        clientId: clientA.id,
        status: "completed",
      }),
    ).toBeNull();

    const untouched = await getProject(db, businessB.id, targetId);
    expect(untouched?.name).toBe("Beta internal");
    expect(untouched?.status).toBe("active");
  });

  it("cannot move a project onto a foreign client via update", async () => {
    const own = await createProject(db, businessA.id, userA, {
      name: "Alpha site",
      clientId: clientA.id,
      status: "active",
    });
    const ownId = (own as { id: string }).id;

    expect(
      await updateProject(db, businessA.id, ownId, {
        name: "Alpha site",
        clientId: clientB.id,
        status: "active",
      }),
    ).toBeNull();
    expect((await getProject(db, businessA.id, ownId))?.clientId).toBe(
      clientA.id,
    );
  });
});

describe("projects service - lifecycle", () => {
  it("creates with defaults, lists with client names, updates status and due date", async () => {
    const due = new Date("2026-07-15T00:00:00Z");
    const created = await createProject(db, businessA.id, userA, {
      name: "Brightwood website",
      clientId: clientA.id,
      status: "active",
      dueDate: due,
    });
    expect(created).not.toBeNull();
    const createdId = (created as { id: string }).id;

    const list = await listProjects(db, businessA.id);
    const row = list.find((p) => p.id === createdId);
    expect(row?.clientName).toBe("Alpha client");
    expect(row?.dueDate).toEqual(due);

    const byClient = await listProjects(db, businessA.id, {
      clientId: clientA.id,
    });
    expect(byClient.some((p) => p.id === createdId)).toBe(true);

    const updated = await updateProject(db, businessA.id, createdId, {
      name: "Brightwood website",
      clientId: clientA.id,
      status: "completed",
      dueDate: null,
    });
    expect(updated?.status).toBe("completed");
    expect(updated?.dueDate).toBeNull();

    // Project creation lands on the client's activity thread.
    const thread = await db
      .select()
      .from(schema.activity)
      .where(eq(schema.activity.clientId, clientA.id));
    const event = thread.find(
      (a) =>
        a.type === "project_created" &&
        (a.payload as { projectId?: string }).projectId === createdId,
    );
    expect(event).toBeDefined();
  });
});
