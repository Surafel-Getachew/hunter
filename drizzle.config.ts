import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    // Migrations use the direct (unpooled) address when there is one, as Neon
    // recommends for schema changes; the Vercel–Neon integration sets
    // DATABASE_URL_UNPOOLED. Locally there is only DATABASE_URL.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "postgres://localhost:5433/jobhunt",
  },
});
