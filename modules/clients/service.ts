import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { schema } from "@/db";

// Every function takes the caller's businessId and applies it to every
// query. Nothing in this module trusts a client id alone - a client id
// from another business behaves exactly like a missing record.

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional(),
  role: z.string().trim().max(100).optional(),
});

export const clientInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional(),
  contacts: z.array(contactSchema).max(50).default([]),
  notes: z.string().trim().max(10_000).optional(),
  // Default hourly rate, minor units + ISO 4217 code. Data only - the
  // time module resolves it, the billing module interprets it.
  defaultRateMinor: z.number().int().nonnegative().nullable().optional(),
  defaultRateCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export async function listClients(
  db: Db,
  businessId: string,
  opts: { includeArchived?: boolean } = {},
) {
  const scope = opts.includeArchived
    ? eq(schema.client.businessId, businessId)
    : and(
        eq(schema.client.businessId, businessId),
        isNull(schema.client.archivedAt),
      );
  return db
    .select()
    .from(schema.client)
    .where(scope)
    .orderBy(desc(schema.client.createdAt));
}

export async function getClient(db: Db, businessId: string, clientId: string) {
  const [row] = await db
    .select()
    .from(schema.client)
    .where(
      and(
        eq(schema.client.businessId, businessId),
        eq(schema.client.id, clientId),
      ),
    );
  return row ?? null;
}

export async function createClient(
  db: Db,
  businessId: string,
  userId: string,
  input: ClientInput,
) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.client)
      .values({
        businessId,
        name: input.name,
        company: input.company ?? null,
        contacts: input.contacts,
        notes: input.notes ?? null,
        defaultRateMinor: input.defaultRateMinor ?? null,
        defaultRateCurrency: input.defaultRateCurrency ?? null,
      })
      .returning();
    await tx.insert(schema.activity).values({
      businessId,
      clientId: created.id,
      userId,
      type: "client_created",
      payload: { name: created.name },
    });
    return created;
  });
}

export async function updateClient(
  db: Db,
  businessId: string,
  userId: string,
  clientId: string,
  input: ClientInput,
) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.client)
      .set({
        name: input.name,
        company: input.company ?? null,
        contacts: input.contacts,
        notes: input.notes ?? null,
        defaultRateMinor: input.defaultRateMinor ?? null,
        defaultRateCurrency: input.defaultRateCurrency ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.client.businessId, businessId),
          eq(schema.client.id, clientId),
        ),
      )
      .returning();
    if (!updated) {
      return null;
    }
    await tx.insert(schema.activity).values({
      businessId,
      clientId: updated.id,
      userId,
      type: "client_updated",
      payload: { name: updated.name },
    });
    return updated;
  });
}

async function setArchived(
  db: Db,
  businessId: string,
  userId: string,
  clientId: string,
  archived: boolean,
) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.client)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.client.businessId, businessId),
          eq(schema.client.id, clientId),
        ),
      )
      .returning();
    if (!updated) {
      return null;
    }
    await tx.insert(schema.activity).values({
      businessId,
      clientId: updated.id,
      userId,
      type: archived ? "client_archived" : "client_unarchived",
      payload: {},
    });
    return updated;
  });
}

export async function archiveClient(
  db: Db,
  businessId: string,
  userId: string,
  clientId: string,
) {
  return setArchived(db, businessId, userId, clientId, true);
}

export async function unarchiveClient(
  db: Db,
  businessId: string,
  userId: string,
  clientId: string,
) {
  return setArchived(db, businessId, userId, clientId, false);
}

export async function listActivity(
  db: Db,
  businessId: string,
  clientId: string,
) {
  // seq, not at: timestamps can collide within a microsecond and the
  // thread must render newest-first in stable insertion order.
  return db
    .select()
    .from(schema.activity)
    .where(
      and(
        eq(schema.activity.businessId, businessId),
        eq(schema.activity.clientId, clientId),
      ),
    )
    .orderBy(desc(schema.activity.seq));
}

export async function addNote(
  db: Db,
  businessId: string,
  userId: string,
  clientId: string,
  text: string,
) {
  // Notes attach only to clients of the caller's business.
  const target = await getClient(db, businessId, clientId);
  if (!target) {
    return null;
  }
  const [created] = await db
    .insert(schema.activity)
    .values({
      businessId,
      clientId,
      userId,
      type: "note",
      payload: { text },
    })
    .returning();
  return created;
}
