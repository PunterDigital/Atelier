import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    // Only needed by drizzle-kit migrate/push; generate works offline.
    url: process.env.DATABASE_URL ?? "",
  },
});
