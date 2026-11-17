// Read side: the job list, applications, and everything the dashboard measures.
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, max, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../db/index.ts";
import {
  applicationEvents,
  applications,
  companies,
  fetchRunSources,
  fetchRuns,
  jobSightings,
  jobs,
  resumeVersions,
  sourceVisits,
} from "../../db/schema.ts";
import { profile } from "./config.ts";
import {
  breakdown,
  findBottleneck,
  outcomeOf,
  speedBucket,
  totals,
  type FunnelApplication,
} from "./funnel.ts";
import { CHANNEL_LABEL, COMPANY_KIND_LABEL, SKIP_REASON_LABEL, type ApplicationStatus } from "./model.ts";
import { ELIGIBILITY_LABEL } from "./format.ts";
import type { Eligibility } from "./types.ts";
import { VISIBLE_TIERS, type JobFilters } from "./view.ts";

const DAY_MS = 86_400_000;

// ── Job list ─────────────────────────────────────────────────────────────────

/** Open to anyone first, then EMEA/time zone, just "Remote", and US/Europe-listed. */
const tierRank = sql`case ${jobs.eligibility} ${sql.join(
  VISIBLE_TIERS.map((tier, i) => sql`when ${tier} then ${sql.raw(String(i))}`),
  sql` `,
)} else ${sql.raw(String(VISIBLE_TIERS.length))} end`;

/** When a posting went up, or when it first appeared here if the board gave no date. */
const postedOrSeen = sql`coalesce(${jobs.postedAt}, ${jobs.firstSeenAt})`;

function viewCondition(view: JobFilters["view"], now: Date): SQL | undefined {
  const notApplied = isNull(applications.id);
  switch (view) {
    case "new":
      // Untouched jobs posted in the last week. Jobs with no known posting date
      // (Himalayas' backlog) and older ones stay under All, and in the stats.
      return and(
        notApplied,
        isNull(jobs.hiddenAt),
        isNull(jobs.savedAt),
        gte(jobs.postedAt, new Date(now.getTime() - profile.maxAgeDays * DAY_MS)),
      );
    case "saved":
      return and(notApplied, isNotNull(jobs.savedAt));
    case "hidden":
      return and(notApplied, isNotNull(jobs.hiddenAt));
    case "all":
      return undefined;
  }
}

export async function listJobs(db: Database, filters: JobFilters, now = new Date()) {
  const conditions: (SQL | undefined)[] = [viewCondition(filters.view, now)];
  if (filters.tiers.length) conditions.push(inArray(jobs.eligibility, filters.tiers));
  if (filters.section !== "all") conditions.push(eq(jobs.category, filters.section));
  if (filters.source !== "all") conditions.push(eq(jobs.source, filters.source));
  if (filters.postedWithinHours) {
    conditions.push(sql`${postedOrSeen} >= ${new Date(now.getTime() - filters.postedWithinHours * 3_600_000)}`);
  }
  for (const word of filters.query.split(/\s+/).filter(Boolean).slice(0, 6)) {
    const pattern = `%${word.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(jobs.title, pattern), ilike(companies.name, pattern), ilike(jobs.description, pattern)));
  }

  return db
    .select({
      id: jobs.id,
      title: jobs.title,
      url: jobs.url,
      source: jobs.source,
      locations: jobs.locations,
      eligibility: jobs.eligibility,
      eligibilityReason: jobs.eligibilityReason,
      category: jobs.category,
      score: jobs.score,
      matchedSkills: jobs.matchedSkills,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryPeriod: jobs.salaryPeriod,
      salaryCurrency: jobs.salaryCurrency,
      employmentType: jobs.employmentType,
      snippet: sql<string>`left(${jobs.description}, 400)`,
      postedAt: jobs.postedAt,
      firstSeenAt: jobs.firstSeenAt,
      savedAt: jobs.savedAt,
      hiddenAt: jobs.hiddenAt,
      skipReason: jobs.skipReason,
      companyId: companies.id,
      company: companies.name,
      companyKind: companies.kind,
      applicationStatus: applications.status,
    })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .where(and(...conditions))
    .orderBy(
      ...(filters.sort === "newest"
        ? [desc(postedOrSeen), desc(jobs.score)]
        : [tierRank, desc(jobs.score), desc(postedOrSeen)]),
    )
    .limit(300);
}

export type JobRow = Awaited<ReturnType<typeof listJobs>>[number];

/** How many jobs each tab holds, for the tab labels. */
export async function jobViewCounts(db: Database, now = new Date()) {
  const counted = async (view: JobFilters["view"]) => {
    const [row] = await db
      .select({ n: count() })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(viewCondition(view, now));
    return row?.n ?? 0;
  };
  const [fresh, saved, hidden] = await Promise.all([counted("new"), counted("saved"), counted("hidden")]);
  return { new: fresh, saved, hidden };
}

export async function listJobSources(db: Database): Promise<string[]> {
  const rows = await db.selectDistinct({ source: jobs.source }).from(jobs).orderBy(asc(jobs.source));
  return rows.map((r) => r.source);
}

// ── Applications ─────────────────────────────────────────────────────────────

export async function listApplications(db: Database, status: ApplicationStatus | "all" | "active" = "all") {
  const where =
    status === "all"
      ? undefined
      : status === "active"
        ? inArray(applications.status, ["applied", "screening", "interviewing", "offer"])
        : eq(applications.status, status);
  const apps = await db
    .select({
      id: applications.id,
      appliedAt: applications.appliedAt,
      channel: applications.channel,
      status: applications.status,
      tailored: applications.tailored,
      coverLetter: applications.coverLetter,
      askedRate: applications.askedRate,
      eligibilityCheck: applications.eligibilityCheck,
      notes: applications.notes,
      resumeVersionId: applications.resumeVersionId,
      resumeVersion: resumeVersions.name,
      jobId: jobs.id,
      title: jobs.title,
      url: jobs.url,
      source: jobs.source,
      eligibility: jobs.eligibility,
      postedAt: jobs.postedAt,
      companyId: companies.id,
      company: companies.name,
      companyKind: companies.kind,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(resumeVersions, eq(resumeVersions.id, applications.resumeVersionId))
    .where(where)
    .orderBy(desc(applications.appliedAt));

  const events = apps.length
    ? await db
        .select()
        .from(applicationEvents)
        .where(inArray(applicationEvents.applicationId, apps.map((a) => a.id)))
        .orderBy(asc(applicationEvents.occurredAt))
    : [];
  return apps.map((app) => ({ ...app, events: events.filter((e) => e.applicationId === app.id) }));
}

export type ApplicationRow = Awaited<ReturnType<typeof listApplications>>[number];

export async function applicationStatusCounts(db: Database) {
  const rows = await db.select({ status: applications.status, n: count() }).from(applications).groupBy(applications.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<ApplicationStatus, number>>;
}

// ── Fetch runs and site visits ───────────────────────────────────────────────

export async function lastFetchRun(db: Database) {
  const [run] = await db.select().from(fetchRuns).orderBy(desc(fetchRuns.startedAt)).limit(1);
  if (!run) return null;
  const sources = await db.select().from(fetchRunSources).where(eq(fetchRunSources.runId, run.id));
  return { ...run, sources };
}

export async function lastVisits(db: Database): Promise<Record<string, string>> {
  const rows = await db
    .select({ sourceId: sourceVisits.sourceId, at: max(sourceVisits.visitedAt) })
    .from(sourceVisits)
    .groupBy(sourceVisits.sourceId);
  return Object.fromEntries(rows.flatMap((r) => (r.at ? [[r.sourceId, new Date(r.at).toISOString()]] : [])));
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

const DISPLAY_SOURCE: Record<string, string> = { "Company boards": "Company career pages" };
export const displaySource = (source: string) => DISPLAY_SOURCE[source] ?? source;

export async function dashboardData(db: Database, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const eightWeeksAgo = new Date(now.getTime() - 56 * DAY_MS);

  const apps = await listApplications(db);
  const funnelApps: FunnelApplication[] = apps.map((a) => ({
    appliedAt: a.appliedAt,
    postedAt: a.postedAt,
    channel: a.channel,
    eligibility: a.eligibility,
    source: a.source,
    companyKind: a.companyKind,
    resumeVersion: a.resumeVersion,
    events: a.events.map((e) => ({ type: e.type, occurredAt: e.occurredAt })),
  }));
  const outcomes = funnelApps.map((a) => outcomeOf(a, now));
  const funnelTotals = totals(funnelApps, outcomes);

  const byTier = breakdown(funnelApps, outcomes, (a) => `${ELIGIBILITY_LABEL[a.eligibility as Eligibility].badge} ${ELIGIBILITY_LABEL[a.eligibility as Eligibility].label}`);
  const bySource = breakdown(funnelApps, outcomes, (a) => displaySource(a.source));
  const byChannel = breakdown(funnelApps, outcomes, (a) => CHANNEL_LABEL[a.channel]);
  const bySpeed = breakdown(funnelApps, outcomes, speedBucket);
  const byCompanyKind = breakdown(funnelApps, outcomes, (a) => COMPANY_KIND_LABEL[a.companyKind]);
  const byResume = breakdown(funnelApps, outcomes, (a) => a.resumeVersion ?? "No CV version set");

  const [matchesWeekly, skipReasons, newBySource, failuresBySource, recentRuns, visitsLast7, lastRun] = await Promise.all([
    db
      .select({ week: sql<string>`to_char(date_trunc('week', ${jobs.firstSeenAt} at time zone 'UTC'), 'YYYY-MM-DD')`, n: count() })
      .from(jobs)
      .where(and(gte(jobs.firstSeenAt, eightWeeksAgo), eq(jobs.addedManually, false)))
      .groupBy(sql`1`),
    db
      .select({ reason: jobs.skipReason, n: count() })
      .from(jobs)
      .where(isNotNull(jobs.skipReason))
      .groupBy(jobs.skipReason),
    // Unique jobs each source brought in over the last week (a job on two boards counts for both).
    db
      .select({ source: jobSightings.source, n: count() })
      .from(jobSightings)
      .where(gte(jobSightings.firstSeenAt, weekAgo))
      .groupBy(jobSightings.source),
    // Failed runs per source over the last week.
    db
      .select({ source: fetchRunSources.source, n: count() })
      .from(fetchRunSources)
      .innerJoin(fetchRuns, eq(fetchRuns.id, fetchRunSources.runId))
      .where(and(gte(fetchRuns.startedAt, weekAgo), eq(fetchRunSources.ok, false)))
      .groupBy(fetchRunSources.source),
    db.select().from(fetchRuns).orderBy(desc(fetchRuns.startedAt)).limit(10),
    db.select({ n: count() }).from(sourceVisits).where(gte(sourceVisits.visitedAt, weekAgo)),
    lastFetchRun(db),
  ]);

  const matchesLast7Days =
    (
      await db
        .select({ n: count() })
        .from(jobs)
        .where(and(gte(jobs.firstSeenAt, weekAgo), eq(jobs.addedManually, false)))
    )[0]?.n ?? 0;
  const applicationsLast7Days = funnelApps.filter((a) => a.appliedAt >= weekAgo).length;

  // Weekly series: matches found vs applications sent, last 8 weeks.
  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) weeks.push(weekStart(new Date(now.getTime() - i * 7 * DAY_MS)));
  const matchesByWeek = new Map(matchesWeekly.map((r) => [r.week, r.n]));
  const appsByWeek = new Map<string, number>();
  for (const a of funnelApps) appsByWeek.set(weekStart(a.appliedAt), (appsByWeek.get(weekStart(a.appliedAt)) ?? 0) + 1);
  const weekly = weeks.map((week) => ({ week, matches: matchesByWeek.get(week) ?? 0, applications: appsByWeek.get(week) ?? 0 }));

  // Per source: what it supplies (new jobs this week, last run) next to what came of it.
  const appsBySource = new Map(bySource.map((r) => [r.key, r]));
  const newCounts = new Map(newBySource.map((r) => [r.source, r.n]));
  const failures = new Map(failuresBySource.map((r) => [r.source, r.n]));
  const sourceNames = new Set([...newCounts.keys(), ...(lastRun?.sources.map((s) => s.source) ?? [])]);
  const sources = [...sourceNames]
    .map((name) => {
      const last = lastRun?.sources.find((s) => s.source === name);
      const app = appsBySource.get(displaySource(name));
      return {
        source: displaySource(name),
        newLast7Days: newCounts.get(name) ?? 0,
        lastRunMatched: last?.matched ?? 0,
        lastRunFetched: last?.fetched ?? 0,
        failures: failures.get(name) ?? 0,
        applications: app?.applications ?? 0,
        positive: app?.positive ?? 0,
      };
    })
    .sort((a, b) => b.newLast7Days - a.newLast7Days);

  const verdict = findBottleneck({ totals: funnelTotals, applicationsLast7Days, matchesLast7Days, bySpeed, byTier, byChannel });

  return {
    verdict,
    totals: funnelTotals,
    applicationsLast7Days,
    matchesLast7Days,
    visitsLast7Days: visitsLast7[0]?.n ?? 0,
    weekly,
    breakdowns: { byTier, bySource, byChannel, bySpeed, byCompanyKind, byResume },
    skipReasons: skipReasons
      .flatMap((r) => (r.reason ? [{ key: SKIP_REASON_LABEL[r.reason], n: r.n }] : []))
      .sort((a, b) => b.n - a.n),
    sources,
    recentRuns,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
