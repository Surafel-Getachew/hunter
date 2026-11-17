import { inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/index.ts";
import { companies, fetchRunSources, jobSightings, jobs } from "../../db/schema.ts";
import type { MatchedJob, PipelineResult } from "./pipeline.ts";

const CHUNK = 100;

/** How the same company is recognised across boards. */
export function normalizeCompany(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "unknown";
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const round = (n: number | null | undefined) => (n == null ? null : Math.round(n));

/** On a re-sighting, refresh what the board says now; keep first-seen, saved, hidden and manual flags. */
const refreshed = (column: string) => sql.raw(`excluded."${column}"`);

/**
 * Writes one fetch's matches: companies, jobs (insert new, refresh known),
 * every board each was seen on, and per-source counts for the run. Also moves
 * stored posting dates earlier when a board now gives an earlier one, including
 * for postings this fetch filtered out as too old. Returns how many jobs were new.
 */
export async function ingest(db: Database, result: PipelineResult, runId: string, now: Date): Promise<number> {
  const matches = [...result.jobs.entries()];
  return db.transaction(async (tx) => {
    const companyNames = new Map<string, string>();
    for (const [, { job }] of matches) companyNames.set(normalizeCompany(job.company), job.company.trim() || "Unknown");

    const companyIds = new Map<string, string>();
    if (companyNames.size) {
      await tx
        .insert(companies)
        .values([...companyNames].map(([normalizedName, name]) => ({ name, normalizedName })))
        .onConflictDoNothing();
      const rows = await tx
        .select({ id: companies.id, normalizedName: companies.normalizedName })
        .from(companies)
        .where(inArray(companies.normalizedName, [...companyNames.keys()]));
      for (const row of rows) companyIds.set(row.normalizedName, row.id);
    }

    let added = 0;
    const jobIds = new Map<string, string>();
    for (const batch of chunks(matches, CHUNK)) {
      const rows = await tx
        .insert(jobs)
        .values(batch.map(([key, match]) => toRow(key, match, companyIds, now)))
        .onConflictDoUpdate({
          target: jobs.dedupeKey,
          set: {
            title: refreshed("title"),
            url: refreshed("url"),
            source: refreshed("source"),
            locations: refreshed("locations"),
            eligibility: refreshed("eligibility"),
            eligibilityReason: refreshed("eligibility_reason"),
            category: refreshed("category"),
            score: refreshed("score"),
            matchedSkills: refreshed("matched_skills"),
            salaryMin: refreshed("salary_min"),
            salaryMax: refreshed("salary_max"),
            salaryPeriod: refreshed("salary_period"),
            salaryCurrency: refreshed("salary_currency"),
            employmentType: refreshed("employment_type"),
            description: refreshed("description"),
            // A posting doesn't get younger: keep the earliest date any fetch has seen.
            postedAt: sql`least(excluded."posted_at", ${jobs.postedAt})`,
            lastSeenAt: refreshed("last_seen_at"),
          },
        })
        // xmax is 0 only for a freshly inserted row.
        .returning({ id: jobs.id, dedupeKey: jobs.dedupeKey, inserted: sql<boolean>`(xmax = 0)` });
      for (const row of rows) {
        jobIds.set(row.dedupeKey, row.id);
        if (row.inserted) added++;
      }
    }

    const sightings = matches.flatMap(([key, { sightings }]) =>
      sightings.map((s) => ({ jobId: jobIds.get(key)!, source: s.source, sourceJobId: s.sourceJobId, url: s.url, firstSeenAt: now, lastSeenAt: now })),
    );
    for (const batch of chunks(sightings, CHUNK)) {
      await tx
        .insert(jobSightings)
        .values(batch)
        .onConflictDoUpdate({
          target: [jobSightings.jobId, jobSightings.source],
          set: { url: refreshed("url"), sourceJobId: refreshed("source_job_id"), lastSeenAt: refreshed("last_seen_at") },
        });
    }

    for (const batch of chunks([...result.postedDates], CHUNK)) {
      const values = sql.join(
        batch.map(([key, date]) => sql`(${key}, ${date.toISOString()}::timestamptz)`),
        sql`, `,
      );
      await tx.execute(sql`
        update ${jobs} set posted_at = v.posted_at
        from (values ${values}) as v(dedupe_key, posted_at)
        where ${jobs.dedupeKey} = v.dedupe_key and (${jobs.postedAt} is null or v.posted_at < ${jobs.postedAt})`);
    }

    if (result.sources.length) {
      await tx.insert(fetchRunSources).values(result.sources.map((s) => ({ runId, ...s })));
    }
    return added;
  });
}

function toRow(key: string, { job }: MatchedJob, companyIds: Map<string, string>, now: Date) {
  return {
    dedupeKey: key,
    companyId: companyIds.get(normalizeCompany(job.company))!,
    title: job.title,
    url: job.url,
    source: job.source,
    locations: job.locations,
    eligibility: job.eligibility,
    eligibilityReason: job.eligibilityReason,
    category: job.category,
    score: job.score,
    matchedSkills: job.matchedSkills,
    salaryMin: round(job.salary?.min),
    salaryMax: round(job.salary?.max),
    salaryPeriod: job.salary?.period ?? null,
    salaryCurrency: job.salary?.currency ?? null,
    employmentType: job.employmentType ?? null,
    description: job.description,
    postedAt: job.postedAt,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}
