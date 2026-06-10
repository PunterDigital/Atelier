import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";

// The tenancy rule from CLAUDE.md: everything is scoped by business_id.
// This test makes the convention structural - any new domain table added
// to the schema without a business_id column fails the gate.
//
// Exemptions are instance-level infrastructure, not business data:
// - business is the tenancy root itself
// - user/session/account/verification are Better Auth's tables; users
//   reach business data only through business_member, which is scoped
const exemptTables = ["business", "user", "session", "account", "verification"];

const tables = Object.values(schema).filter((value) => is(value, PgTable));

describe("schema tenancy convention", () => {
  it("sees the schema tables (guards against the filter going stale)", () => {
    expect(tables.length).toBeGreaterThanOrEqual(3);
  });

  it("scopes every domain table by business_id", () => {
    for (const table of tables) {
      const name = getTableName(table);
      if (exemptTables.includes(name)) {
        continue;
      }
      const columnNames = Object.values(getTableColumns(table)).map(
        (column) => column.name,
      );
      expect(columnNames, `table "${name}" must carry business_id`).toContain(
        "business_id",
      );
    }
  });
});
