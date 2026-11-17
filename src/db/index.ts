import { attachDatabasePool } from "@vercel/functions";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

/** Any Drizzle Postgres database with our schema: node-postgres in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

// In production DATABASE_URL is Neon's *pooled* address (host contains
// "-pooler"), which shares a few real connections between many app instances.
// The pool connects lazily, so importing this module opens nothing.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5433/jobhunt",
});

// On Vercel, close this instance's idle connections before it is suspended.
// Does nothing elsewhere.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema, casing: "snake_case" });

export { pool };
