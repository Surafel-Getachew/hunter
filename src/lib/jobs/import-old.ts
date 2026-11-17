// Moves the old local file (data/db.json) into Postgres. Used once by
// scripts/import-json.ts; safe to re-run, since anything already imported is skipped.
import { eq } from "drizzle-orm";
import type { Database } from "../../db/index.ts";
import { applicationEvents, applications, companies, jobs, sourceVisits } from "../../db/schema.ts";
import { deriveStatus } from "./funnel.ts";
import { normalizeCompany } from "./ingest.ts";
import type { EventType } from "./model.ts";
import type { Eligibility, JobCategory, Salary } from "./types.ts";

interface OldJob {
  key: string;
  source: string;
  title: string;
  company: string;
  url: string;
  locations: string[];
  snippet: string;
  postedAt: string | null;
  employmentType?: string;
  salary?: Salary;
  category: JobCategory;
  eligibility: Eligibility;
  eligibilityReason: string;
  score: number;
  matchedSkills: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}
interface OldTracking {
  status: "saved" | "applied" | "interviewing" | "offer" | "rejected";
  note: string;
  updatedAt: string;
  appliedAt?: string;
}
export interface OldDb {
  jobs: Record<string, OldJob>;
  tracking: Record<string, OldTracking>;
  dismissed: Record<string, string>;
  visits?: Record<string, string>;
}

/** What the old status implies happened after applying. */
const LATER_EVENT: Partial<Record<OldTracking["status"], EventType>> = {
  interviewing: "technical_interview",
  offer: "offer",
  rejected: "rejected",
};

export async function importOldData(db: Database, old: OldDb): Promise<{ jobs: number; applications: number; visits: number }> {
  let jobsAdded = 0;
  let appsAdded = 0;
  for (const job of Object.values(old.jobs)) {
    const tracked = old.tracking[job.key];
    const normalizedName = normalizeCompany(job.company);
    await db.insert(companies).values({ name: job.company || "Unknown", normalizedName }).onConflictDoNothing();
    const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.normalizedName, normalizedName));

    const [inserted] = await db
      .insert(jobs)
      .values({
        dedupeKey: job.key,
        companyId: company!.id,
        title: job.title,
        url: job.url,
        source: job.source,
        locations: job.locations,
        eligibility: job.eligibility,
        eligibilityReason: job.eligibilityReason,
        category: job.category,
        score: job.score,
        matchedSkills: job.matchedSkills,
        salaryMin: job.salary?.min == null ? null : Math.round(job.salary.min),
        salaryMax: job.salary?.max == null ? null : Math.round(job.salary.max),
        salaryPeriod: job.salary?.period ?? null,
        salaryCurrency: job.salary?.currency ?? null,
        employmentType: job.employmentType ?? null,
        description: job.snippet,
        // Himalayas' dates are when it last refreshed a posting (see sources/himalayas.ts).
        postedAt: job.postedAt && job.source !== "Himalayas" ? new Date(job.postedAt) : null,
        firstSeenAt: new Date(job.firstSeenAt),
        lastSeenAt: new Date(job.lastSeenAt),
        savedAt: tracked?.status === "saved" ? new Date(tracked.updatedAt) : null,
        hiddenAt: old.dismissed[job.key] ? new Date(old.dismissed[job.key]!) : null,
        skipReason: old.dismissed[job.key] ? "other" : null,
      })
      .onConflictDoNothing({ target: jobs.dedupeKey })
      .returning({ id: jobs.id });
    if (inserted) jobsAdded++;

    if (!tracked || tracked.status === "saved") continue;
    const [row] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.dedupeKey, job.key));
    const appliedAt = new Date(tracked.appliedAt ?? tracked.updatedAt);
    const [app] = await db
      .insert(applications)
      .values({ jobId: row!.id, appliedAt, channel: "other", notes: tracked.note })
      .onConflictDoNothing({ target: applications.jobId })
      .returning({ id: applications.id });
    if (!app) continue;
    appsAdded++;
    const events: { type: EventType; occurredAt: Date }[] = [{ type: "applied", occurredAt: appliedAt }];
    const later = LATER_EVENT[tracked.status];
    if (later) events.push({ type: later, occurredAt: new Date(tracked.updatedAt) });
    await db.insert(applicationEvents).values(events.map((e) => ({ applicationId: app.id, ...e })));
    await db.update(applications).set({ status: deriveStatus(events) }).where(eq(applications.id, app.id));
  }

  // Visits have no natural key: skip any already imported (same site, same moment).
  const existing = new Set((await db.select().from(sourceVisits)).map((v) => `${v.sourceId}@${v.visitedAt.getTime()}`));
  const visits = Object.entries(old.visits ?? {})
    .map(([sourceId, at]) => ({ sourceId, visitedAt: new Date(at) }))
    .filter((v) => !existing.has(`${v.sourceId}@${v.visitedAt.getTime()}`));
  if (visits.length) await db.insert(sourceVisits).values(visits);
  return { jobs: jobsAdded, applications: appsAdded, visits: visits.length };
}
