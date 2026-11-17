// Fetch jobs from the terminal: `npm run fetch` (saves to DATABASE_URL) or
// `npm run fetch:dry` (prints the best matches, saves nothing).
import { parseArgs } from "node:util";
import { db, pool } from "../src/db/index.ts";
import { ELIGIBILITY_LABEL } from "../src/lib/jobs/format.ts";
import { runPipeline } from "../src/lib/jobs/pipeline.ts";
import { refreshJobs } from "../src/lib/jobs/refresh.ts";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
    hours: { type: "string" },
  },
});

let maxAgeHours: number | undefined;
if (values.hours !== undefined) {
  maxAgeHours = Number(values.hours);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error(`Invalid --hours value: ${values.hours}`);
}
const log = (line: string) => console.log(line);

try {
  if (values["dry-run"]) {
    const { jobs, sources, fetched } = await runPipeline({ maxAgeHours, verbose: values.verbose, log });
    console.log(`\nfetched ${fetched}, matched ${jobs.size}`);
    for (const s of sources) console.log(`  ${s.source}: ${s.matched}/${s.fetched}${s.ok ? "" : ` FAILED (${s.error})`}`);
    const top = [...jobs.values()].map((m) => m.job).sort((a, b) => b.score - a.score).slice(0, 30);
    for (const job of top) {
      const section = job.category === "ai-training" ? " [AI-training]" : "";
      console.log(`${String(job.score).padStart(3)} ${ELIGIBILITY_LABEL[job.eligibility].badge} ${job.title} · ${job.company}${section}\n      ${job.url}`);
    }
    console.log("\nDry run: nothing saved.");
  } else {
    const summary = await refreshJobs(db, { trigger: "cli", maxAgeHours, verbose: values.verbose, log });
    console.log(
      `\nSaved: ${summary.added} new, ${summary.matched} matched of ${summary.fetched} fetched` +
        (summary.failedSources.length ? `; failed: ${summary.failedSources.join(", ")}` : ""),
    );
  }
} finally {
  await pool.end();
}
