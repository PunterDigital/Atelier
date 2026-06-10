import { asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";

// Single source of truth for resolving a user's active business. Until
// multi-entity switching lands (Phase 4), the active business is the oldest
// membership - deterministic, and correct for the single-business case.
export async function getActiveMembership(userId: string) {
  const memberships = await getDb()
    .select({
      businessId: schema.businessMember.businessId,
      role: schema.businessMember.role,
    })
    .from(schema.businessMember)
    .where(eq(schema.businessMember.userId, userId))
    .orderBy(asc(schema.businessMember.createdAt))
    .limit(1);

  return memberships[0] ?? null;
}
