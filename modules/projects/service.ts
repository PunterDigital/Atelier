import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { schema } from "@/db";

// Same tenancy contract as modules/clients: every query carries the
// caller's businessId, and a foreign id behaves like a missing record.

export const projectStatusSchema = z.enum(["active", "on_hold", "completed"]);

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  clientId: z.string().uuid(),
  status: projectStatusSchema.default("active"),
  dueDate: z.date().nullable().optional(),
  // Overrides the client default for rate resolution (billing spec S7).
  defaultRateMinor: z.number().int().nonnegative().nullable().optional(),
  defaultRateCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  defaultRateUnit: z.enum(["hour", "day"]).optional(),
  budgetMinor: z.number().int().nonnegative().nullable().optional(),
  budgetCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

async function clientInBusiness(db: Db, businessId: string, clientId: string) {
  const [row] = await db
    .select({ id: schema.client.id })
    .from(schema.client)
    .where(
      and(
        eq(schema.client.businessId, businessId),
        eq(schema.client.id, clientId),
      ),
    );
  return Boolean(row);
}

export async function listProjects(
  db: Db,
  businessId: string,
  opts: { clientId?: string } = {},
) {
  const scope = opts.clientId
    ? and(
        eq(schema.project.businessId, businessId),
        eq(schema.project.clientId, opts.clientId),
      )
    : eq(schema.project.businessId, businessId);
  return db
    .select({
      id: schema.project.id,
      name: schema.project.name,
      status: schema.project.status,
      dueDate: schema.project.dueDate,
      createdAt: schema.project.createdAt,
      clientId: schema.project.clientId,
      clientName: schema.client.name,
    })
    .from(schema.project)
    .innerJoin(schema.client, eq(schema.project.clientId, schema.client.id))
    .where(scope)
    .orderBy(desc(schema.project.createdAt));
}

export async function getProject(db: Db, businessId: string, projectId: string) {
  const [row] = await db
    .select({
      id: schema.project.id,
      name: schema.project.name,
      status: schema.project.status,
      dueDate: schema.project.dueDate,
      createdAt: schema.project.createdAt,
      clientId: schema.project.clientId,
      clientName: schema.client.name,
      defaultRateMinor: schema.project.defaultRateMinor,
      defaultRateCurrency: schema.project.defaultRateCurrency,
      defaultRateUnit: schema.project.defaultRateUnit,
      budgetMinor: schema.project.budgetMinor,
      budgetCurrency: schema.project.budgetCurrency,
    })
    .from(schema.project)
    .innerJoin(schema.client, eq(schema.project.clientId, schema.client.id))
    .where(
      and(
        eq(schema.project.businessId, businessId),
        eq(schema.project.id, projectId),
      ),
    );
  return row ?? null;
}

export async function createProject(
  db: Db,
  businessId: string,
  userId: string,
  input: ProjectInput,
) {
  // The linked client must belong to the same business - a cross-business
  // client id is rejected exactly like a nonexistent one.
  if (!(await clientInBusiness(db, businessId, input.clientId))) {
    return null;
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.project)
      .values({
        businessId,
        clientId: input.clientId,
        name: input.name,
        status: input.status,
        dueDate: input.dueDate ?? null,
        defaultRateMinor: input.defaultRateMinor ?? null,
        defaultRateCurrency: input.defaultRateCurrency ?? null,
        defaultRateUnit: input.defaultRateUnit ?? "hour",
        budgetMinor: input.budgetMinor ?? null,
        budgetCurrency: input.budgetCurrency ?? null,
      })
      .returning();
    await tx.insert(schema.activity).values({
      businessId,
      clientId: input.clientId,
      userId,
      type: "project_created",
      payload: { name: created.name, projectId: created.id },
    });
    return created;
  });
}

export async function updateProject(
  db: Db,
  businessId: string,
  projectId: string,
  input: ProjectInput,
) {
  if (!(await clientInBusiness(db, businessId, input.clientId))) {
    return null;
  }
  const [updated] = await db
    .update(schema.project)
    .set({
      name: input.name,
      clientId: input.clientId,
      status: input.status,
      dueDate: input.dueDate ?? null,
      defaultRateMinor: input.defaultRateMinor ?? null,
      defaultRateCurrency: input.defaultRateCurrency ?? null,
      defaultRateUnit: input.defaultRateUnit ?? "hour",
      budgetMinor: input.budgetMinor ?? null,
      budgetCurrency: input.budgetCurrency ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.project.businessId, businessId),
        eq(schema.project.id, projectId),
      ),
    )
    .returning();
  return updated ?? null;
}
