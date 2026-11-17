// Runs the real migrations and queries against PGlite (Postgres in-process).
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { count, eq, sql } from "drizzle-orm";
import type { Database } from "../src/db/index.ts";
import { applications, companies, fetchRunSources, fetchRuns, jobSightings, jobs, resumeVersions } from "../src/db/schema.ts";
import { ingest } from "../src/lib/jobs/ingest.ts";
import type { MatchedJob, PipelineResult } from "../src/lib/jobs/pipeline.ts";
import { dashboardData, jobViewCounts, lastVisits, listApplications, listJobs } from "../src/lib/jobs/queries.ts";
import { FetchInProgressError, refreshJobs } from "../src/lib/jobs/refresh.ts";
import {
  addEvent,
  addManualApplication,
  applyToJob,
  createResumeVersion,
  deleteApplication,
  deleteEvent,
  hideJob,
  recordVisit,
  setSaved,
  unhideJob,
  updateApplication,
} from "../src/lib/jobs/tracking.ts";
import type { ScoredJob } from "../src/lib/jobs/types.ts";
import { DEFAULT_FILTERS } from "../src/lib/jobs/view.ts";
import { testDb } from "./helpers/pglite.ts";

const now = new Date("2026-11-02T10:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const scored = (title: string, extra: Partial<ScoredJob> = {}): ScoredJob => ({
  id: `himalayas:${title}`,
  source: "Himalayas",
  title,
  company: "Acme Inc.",
  url: `https://example.com/${encodeURIComponent(title)}`,
  locations: ["Worldwide"],
  description: "We use React, Node.js and TypeScript.",
  postedAt: hoursAgo(5),
  category: "main",
  eligibility: "open",
  eligibilityReason: "Worldwide",
  score: 12,
  matchedSkills: ["react", "node"],
  ...extra,
});

function result(entries: [string, MatchedJob][], postedDates: [string, Date][] = []): PipelineResult {
  return {
    jobs: new Map(entries),
    fetched: 100,
    postedDates: new Map(postedDates),
    sources: [
      { source: "Himalayas", ok: true, error: null, fetched: 80, matched: entries.length, rejected: { eligibility: 50, relevance: 28 } },
      { source: "RemoteOK", ok: false, error: "HTTP 503", fetched: 0, matched: 0, rejected: {} },
    ],
  };
}

const match = (job: ScoredJob, ...boards: string[]): MatchedJob => ({
  job,
  sightings: [job.source, ...boards].map((source) => ({ source, sourceJobId: `${source}:${job.title}`, url: job.url })),
});

async function run(db: Database, at = now): Promise<string> {
  const [row] = await db.insert(fetchRuns).values({ trigger: "cli", startedAt: at }).returning({ id: fetchRuns.id });
  return row!.id;
}

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await testDb());
});
after(async () => close());
beforeEach(async () => {
  await db.execute(sql`truncate companies, jobs, fetch_runs, resume_versions, source_visits cascade`);
});

describe("ingest", () => {
  it("adds new jobs once, refreshes known ones and keeps what you did with them", async () => {
    const first = await ingest(db, result([["acme|a", match(scored("A"), "Arc")], ["acme|b", match(scored("B"))]]), await run(db), now);
    assert.equal(first, 2);

    const [a] = await db.select().from(jobs).where(eq(jobs.dedupeKey, "acme|a"));
    await hideJob(db, a!.id, "wrong_stack", null, now);

    const later = new Date(now.getTime() + 86_400_000);
    const second = await ingest(db, result([["acme|a", match(scored("A", { score: 15 }))], ["acme|c", match(scored("C"))]]), await run(db, later), later);
    assert.equal(second, 1, "only C is new");

    const [refreshed] = await db.select().from(jobs).where(eq(jobs.dedupeKey, "acme|a"));
    assert.equal(refreshed!.score, 15);
    assert.equal(refreshed!.firstSeenAt.toISOString(), now.toISOString());
    assert.equal(refreshed!.lastSeenAt.toISOString(), later.toISOString());
    assert.ok(refreshed!.hiddenAt, "still hidden");
  });

  it("records every board a job appeared on, one company per name, and per-source stats", async () => {
    const runId = await run(db);
    await ingest(db, result([["acme|a", match(scored("A"), "Arc", "Workable")], ["acme|b", match(scored("B", { company: "ACME inc" }))]]), runId, now);
    const sightings = await db.select().from(jobSightings);
    assert.deepEqual(sightings.map((s) => s.source).sort(), ["Arc", "Himalayas", "Himalayas", "Workable"]);
    const [companyCount] = await db.select({ n: count() }).from(companies);
    assert.equal(companyCount!.n, 1, "“Acme Inc.” and “ACME inc” are the same company");
    const stats = await db.select().from(fetchRunSources).where(eq(fetchRunSources.runId, runId));
    assert.deepEqual(stats.find((s) => s.source === "Himalayas")?.rejected, { eligibility: 50, relevance: 28 });
    assert.equal(stats.find((s) => s.source === "RemoteOK")?.ok, false);
  });

  it("never moves a posting date later, and corrects it from postings the fetch filtered out", async () => {
    await ingest(db, result([["acme|a", match(scored("A", { postedAt: hoursAgo(30) }))], ["acme|b", match(scored("B"))]]), await run(db), now);

    // A board bumps A's date on a re-index; B now shows up only as a posting too old to match.
    await ingest(db, result([["acme|a", match(scored("A", { postedAt: hoursAgo(1) }))]], [["acme|b", hoursAgo(500)]]), await run(db), now);
    const posted = Object.fromEntries((await db.select().from(jobs)).map((j) => [j.title, j.postedAt?.toISOString()]));
    assert.deepEqual(posted, { A: hoursAgo(30).toISOString(), B: hoursAgo(500).toISOString() });
  });
});

describe("job list", () => {
  it("separates new, saved, hidden and applied jobs", async () => {
    await ingest(db, result(["A", "B", "C", "D"].map((t) => [`acme|${t.toLowerCase()}`, match(scored(t))])), await run(db), now);
    const all = await db.select().from(jobs);
    const id = (t: string) => all.find((j) => j.title === t)!.id;
    await setSaved(db, id("B"), true, now);
    await hideJob(db, id("C"), "salary", "too low", now);
    await applyToJob(db, id("D"), { channel: "company_site", appliedAt: now });

    const titles = async (view: typeof DEFAULT_FILTERS.view) =>
      (await listJobs(db, { ...DEFAULT_FILTERS, view }, now)).map((j) => j.title).sort();
    assert.deepEqual(await titles("new"), ["A"]);
    assert.deepEqual(await titles("saved"), ["B"]);
    assert.deepEqual(await titles("hidden"), ["C"]);
    assert.deepEqual(await titles("all"), ["A", "B", "C", "D"]);
    assert.deepEqual(await jobViewCounts(db, now), { new: 1, saved: 1, hidden: 1 });

    await unhideJob(db, id("C"));
    assert.deepEqual(await titles("new"), ["A", "C"]);
  });

  it("leaves postings older than a week, or undated, out of New, even when found today", async () => {
    await ingest(
      db,
      result([
        ["acme|fresh", match(scored("Fresh"))],
        ["acme|repost", match(scored("Repost", { postedAt: hoursAgo(8 * 24) }))],
        ["acme|undated", match(scored("Undated", { postedAt: null }))],
      ]),
      await run(db),
      now,
    );
    assert.deepEqual((await listJobs(db, DEFAULT_FILTERS, now)).map((j) => j.title), ["Fresh"]);
    assert.equal((await listJobs(db, { ...DEFAULT_FILTERS, view: "all" }, now)).length, 3);
  });

  it("filters by tier, section, source, posting age and search", async () => {
    await ingest(
      db,
      result([
        ["acme|old", match(scored("Old React role", { postedAt: hoursAgo(60) }))],
        ["acme|us", match(scored("US role", { eligibility: "possible" }))],
        ["acme|ai", match(scored("AI Trainer – Coding", { category: "ai-training", source: "Arc" }))],
      ]),
      await run(db),
      now,
    );
    const titles = async (f: Partial<typeof DEFAULT_FILTERS>) => (await listJobs(db, { ...DEFAULT_FILTERS, ...f }, now)).map((j) => j.title).sort();
    assert.deepEqual(await titles({ tiers: ["possible"] }), ["US role"]);
    assert.deepEqual(await titles({ section: "ai-training" }), ["AI Trainer – Coding"]);
    assert.deepEqual(await titles({ source: "Arc" }), ["AI Trainer – Coding"]);
    assert.deepEqual(await titles({ postedWithinHours: 24 }), ["AI Trainer – Coding", "US role"]);
    assert.deepEqual(await titles({ query: "old react" }), ["Old React role"]);
    assert.deepEqual(await titles({ query: "100%_" }), [], "LIKE wildcards in a search are literal");
  });

  it("lists jobs open to anyone first, then by score", async () => {
    await ingest(
      db,
      result([
        ["acme|us", match(scored("US, strong match", { eligibility: "possible", score: 20 }))],
        ["acme|remote", match(scored("Just remote", { eligibility: "unknown", score: 18 }))],
        ["acme|open", match(scored("Anywhere, weak", { eligibility: "open", score: 8 }))],
        ["acme|open2", match(scored("Anywhere, strong", { eligibility: "open", score: 15 }))],
      ]),
      await run(db),
      now,
    );
    assert.deepEqual(
      (await listJobs(db, DEFAULT_FILTERS, now)).map((j) => j.title),
      ["Anywhere, strong", "Anywhere, weak", "Just remote", "US, strong match"],
    );
  });
});

describe("applications", () => {
  it("tracks status through events, and undoing them", async () => {
    await ingest(db, result([["acme|a", match(scored("A"))]]), await run(db), now);
    const [job] = await db.select().from(jobs);
    await createResumeVersion(db, { name: "Nov 2026" });
    const appId = await applyToJob(db, job!.id, { channel: "easy_apply", appliedAt: now });

    const [app] = await db.select().from(applications);
    const [cv] = await db.select().from(resumeVersions);
    assert.equal(app!.resumeVersionId, cv!.id, "the default CV version is used");
    await assert.rejects(() => applyToJob(db, job!.id, { channel: "email" }), /already applied/);

    await addEvent(db, appId, { type: "recruiter_reply", occurredAt: new Date(now.getTime() + 86_400_000) });
    await addEvent(db, appId, { type: "technical_interview", occurredAt: new Date(now.getTime() + 3 * 86_400_000) });
    let [row] = await listApplications(db);
    assert.equal(row!.status, "interviewing");
    assert.deepEqual(row!.events.map((e) => e.type), ["applied", "recruiter_reply", "technical_interview"]);

    await deleteEvent(db, row!.events[2]!.id);
    [row] = await listApplications(db);
    assert.equal(row!.status, "screening");
    await deleteEvent(db, row!.events[0]!.id);
    assert.equal((await listApplications(db))[0]!.events.length, 2, "the applied event can't be deleted");

    await updateApplication(db, appId, { eligibilityCheck: "confirmed_open", notes: "Talked to the CTO" });
    [row] = await listApplications(db);
    assert.equal(row!.eligibilityCheck, "confirmed_open");

    await deleteApplication(db, appId);
    assert.equal((await listApplications(db)).length, 0);
    assert.equal((await listJobs(db, DEFAULT_FILTERS, now)).length, 1, "the job is back in the list");
  });

  it("logs a job found by hand, attaching to the same posting if the fetch has it", async () => {
    await ingest(db, result([["acmeinc|seniorengineer", match(scored("Senior Engineer"))]]), await run(db), now);
    await addManualApplication(
      db,
      { company: "Acme Inc.", title: "Senior Engineer", url: "https://linkedin.com/jobs/1", source: "LinkedIn", eligibility: "possible" },
      { channel: "easy_apply", appliedAt: now },
    );
    await addManualApplication(
      db,
      { company: "Globex", title: "Full Stack Dev", url: "https://linkedin.com/jobs/2", source: "LinkedIn", eligibility: "possible" },
      { channel: "easy_apply", appliedAt: now },
    );
    const apps = await listApplications(db);
    assert.equal(apps.length, 2);
    assert.equal(apps.find((a) => a.company === "Acme Inc.")?.source, "Himalayas", "attached to the fetched job");
    assert.equal(apps.find((a) => a.company === "Globex")?.source, "LinkedIn");
    assert.equal((await db.select().from(jobs)).length, 2);
  });
});

describe("dashboard", () => {
  it("measures volume, replies and sources from the stored data", async () => {
    const runId = await run(db, hoursAgo(1));
    await ingest(db, result(["A", "B", "C"].map((t) => [`acme|${t.toLowerCase()}`, match(scored(t))])), runId, hoursAgo(1));
    const all = await db.select().from(jobs);
    const app1 = await applyToJob(db, all[0]!.id, { channel: "company_site", appliedAt: hoursAgo(1) });
    await applyToJob(db, all[1]!.id, { channel: "easy_apply", appliedAt: hoursAgo(1) });
    await addEvent(db, app1, { type: "screen", occurredAt: now });
    await hideJob(db, all[2]!.id, "seniority", null, now);
    await recordVisit(db, "linkedin-emea", now);

    const d = await dashboardData(db, now);
    assert.equal(d.matchesLast7Days, 3);
    assert.equal(d.applicationsLast7Days, 2);
    assert.equal(d.totals.positive, 1);
    assert.equal(d.verdict.stage, "volume");
    assert.deepEqual(d.skipReasons, [{ key: "Wrong seniority", n: 1 }]);
    assert.equal(d.visitsLast7Days, 1);
    assert.equal(d.weekly.at(-1)!.applications, 2);
    const himalayas = d.sources.find((s) => s.source === "Himalayas");
    assert.deepEqual([himalayas?.newLast7Days, himalayas?.lastRunMatched, himalayas?.applications, himalayas?.positive], [3, 3, 2, 1]);
    assert.equal(d.sources.find((s) => s.source === "RemoteOK")?.failures, 1);
    assert.ok((await lastVisits(db))["linkedin-emea"]);
    await assert.rejects(() => recordVisit(db, "not-a-site"));
  });
});

describe("refreshJobs", () => {
  it("refuses to start while another fetch is running", async () => {
    await db.insert(fetchRuns).values({ trigger: "cron", startedAt: new Date() });
    await assert.rejects(() => refreshJobs(db, { trigger: "manual" }), FetchInProgressError);
  });
});

describe("importOldData", () => {
  it("moves the old JSON file in once: jobs, saved/hidden, applications with status, visits", async () => {
    const { importOldData } = await import("../src/lib/jobs/import-old.ts");
    const job = (key: string, title: string) => ({
      key,
      source: "Himalayas",
      title,
      company: "Acme",
      url: `https://example.com/${key}`,
      locations: ["Worldwide"],
      snippet: "React",
      postedAt: hoursAgo(50).toISOString(),
      category: "main" as const,
      eligibility: "open" as const,
      eligibilityReason: "Worldwide",
      score: 10,
      matchedSkills: ["react"],
      firstSeenAt: hoursAgo(48).toISOString(),
      lastSeenAt: hoursAgo(48).toISOString(),
    });
    const old = {
      jobs: { a: job("a", "A"), b: job("b", "B"), c: job("c", "C"), d: job("d", "D") },
      tracking: {
        a: { status: "applied" as const, note: "sent", updatedAt: hoursAgo(40).toISOString(), appliedAt: hoursAgo(40).toISOString() },
        b: { status: "interviewing" as const, note: "", updatedAt: hoursAgo(10).toISOString(), appliedAt: hoursAgo(30).toISOString() },
        c: { status: "saved" as const, note: "", updatedAt: hoursAgo(20).toISOString() },
      },
      dismissed: { d: hoursAgo(5).toISOString() },
      visits: { "linkedin-emea": hoursAgo(3).toISOString() },
    };
    assert.deepEqual(await importOldData(db, old), { jobs: 4, applications: 2, visits: 1 });
    assert.deepEqual(await importOldData(db, old), { jobs: 0, applications: 0, visits: 0 }, "re-running adds nothing");

    const apps = await listApplications(db);
    assert.deepEqual(apps.map((a) => [a.title, a.status, a.events.length]).sort(), [["A", "applied", 1], ["B", "interviewing", 2]]);
    const titles = async (view: typeof DEFAULT_FILTERS.view) => (await listJobs(db, { ...DEFAULT_FILTERS, view }, now)).map((j) => j.title);
    assert.deepEqual(await titles("saved"), ["C"]);
    assert.deepEqual(await titles("hidden"), ["D"]);
  });
});
