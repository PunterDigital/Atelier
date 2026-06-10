import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Phase 0 core schema, per the data model sketch in the software plan.
// Tenancy rule: every table holding business data carries business_id and
// every query is scoped by it (enforced by db/schema.test.ts).
//
// tax_config and branding are opaque blobs here on purpose: their shape is
// owned by the billing spec (ESC-2) and the design system respectively, and
// nothing reads them yet.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const business = pgTable("business", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // ISO 4217 code for the business's base currency. Stored as data only -
  // all interpretation (conversion, rounding) belongs to the billing module.
  currency: text("currency").notNull(),
  taxConfig: jsonb("tax_config").notNull().default({}),
  branding: jsonb("branding").notNull().default({}),
  ...timestamps,
});

export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => business.id),
    email: text("email").notNull().unique(),
    role: text("role").notNull(),
    ...timestamps,
  },
  (table) => [index("user_business_id_idx").on(table.businessId)],
);

export const client = pgTable(
  "client",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => business.id),
    name: text("name").notNull(),
    company: text("company"),
    contacts: jsonb("contacts").notNull().default([]),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("client_business_id_idx").on(table.businessId)],
);
