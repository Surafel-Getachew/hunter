// One-time move of the old local file (data/db.json) into Postgres:
// jobs, saved/hidden state, applications with their status, and site visits.
// Safe to re-run: anything already imported is skipped.
//   npm run db:import-json [-- path/to/db.json]
import { readFile } from "node:fs/promises";
import { db, pool } from "../src/db/index.ts";
import { importOldData, type OldDb } from "../src/lib/jobs/import-old.ts";

const file = process.argv[2] ?? "data/db.json";
try {
  const old = JSON.parse(await readFile(file, "utf8")) as OldDb;
  const n = await importOldData(db, old);
  console.log(`Imported ${n.jobs} jobs, ${n.applications} applications, ${n.visits} site visits from ${file}.`);
  console.log("Applications from the old file have channel “Other”; set the real one on the Applications page if you remember it.");
} finally {
  await pool.end();
}
