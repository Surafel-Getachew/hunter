// Everything needed to find where the job search stalls: what the fetch found
// (supply), what you skipped and why (filter quality), what you applied to and
// how (volume, speed, CV), and what happened after (each stage of the funnel).
//
// Column names are snake_case in Postgres; `casing: "snake_case"` in the
// Drizzle config maps them from these camelCase keys.
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  APPLICATION_CHANNELS,
  APPLICATION_STATUSES,
  COMPANY_KINDS,
  ELIGIBILITIES,
  ELIGIBILITY_CHECKS,
  EVENT_TYPES,
  JOB_CATEGORIES,
  SKIP_REASONS,
} from "../lib/jobs/model.ts";

export * from "./auth-schema.ts";

const timestamptz = () => timestamp({ withTimezone: true });

// ── Enums ────────────────────────────────────────────────────────────────────

export const eligibilityEnum = pgEnum("eligibility", ELIGIBILITIES);
export const jobCategoryEnum = pgEnum("job_category", JOB_CATEGORIES);
export const companyKindEnum = pgEnum("company_kind", COMPANY_KINDS);
export const skipReasonEnum = pgEnum("skip_reason", SKIP_REASONS);
export const applicationChannelEnum = pgEnum("application_channel", APPLICATION_CHANNELS);
export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUSES);
export const eligibilityCheckEnum = pgEnum("eligibility_check", ELIGIBILITY_CHECKS);
export const applicationEventTypeEnum = pgEnum("application_event_type", EVENT_TYPES);
export const fetchTriggerEnum = pgEnum("fetch_trigger", ["manual", "cron", "cli"]);

// ── Supply: what the fetch found ─────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** Lowercased letters and digits only; how the same company is recognised across boards. */
  normalizedName: text().notNull().unique(),
  /** Employer, recruiting agency or talent network: agencies may never reply. */
  kind: companyKindEnum().notNull().default("unknown"),
  /** Learned along the way: null until you know. */
  hiresAbroad: boolean(),
  website: text(),
  notes: text().notNull().default(""),
  createdAt: timestamptz().notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** company|title, normalised: one row per posting however many boards carry it. */
    dedupeKey: text().notNull().unique(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    title: text().notNull(),
    /** Link to the best-scoring copy. */
    url: text().notNull(),
    /** Fetch source of that copy ("Himalayas", "Workable"…), or where you found it by hand ("LinkedIn"). */
    source: text().notNull(),
    locations: text().array().notNull().default(sql`'{}'::text[]`),
    eligibility: eligibilityEnum().notNull(),
    eligibilityReason: text().notNull().default(""),
    category: jobCategoryEnum().notNull().default("main"),
    score: smallint().notNull().default(0),
    matchedSkills: text().array().notNull().default(sql`'{}'::text[]`),
    salaryMin: integer(),
    salaryMax: integer(),
    salaryPeriod: text(),
    salaryCurrency: text(),
    employmentType: text(),
    description: text().notNull().default(""),
    postedAt: timestamptz(),
    firstSeenAt: timestamptz().notNull().defaultNow(),
    lastSeenAt: timestamptz().notNull().defaultNow(),
    /** Added by you (a LinkedIn or referral job), not by the fetch. */
    addedManually: boolean().notNull().default(false),
    savedAt: timestamptz(),
    hiddenAt: timestamptz(),
    skipReason: skipReasonEnum(),
    skipNote: text(),
  },
  (t) => [
    index().on(t.firstSeenAt),
    index().on(t.postedAt),
    index().on(t.companyId),
    index().on(t.hiddenAt),
  ],
);

/** Every board a job appeared on, so applications and replies can be traced back to sources. */
export const jobSightings = pgTable(
  "job_sightings",
  {
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    source: text().notNull(),
    sourceJobId: text().notNull(),
    url: text().notNull(),
    firstSeenAt: timestamptz().notNull().defaultNow(),
    lastSeenAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.source] })],
);

export const fetchRuns = pgTable(
  "fetch_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    trigger: fetchTriggerEnum().notNull(),
    startedAt: timestamptz().notNull().defaultNow(),
    /** Null while running; a run older than ten minutes without it is treated as crashed. */
    finishedAt: timestamptz(),
    durationMs: integer(),
    maxAgeHours: integer(),
    fetched: integer().notNull().default(0),
    matched: integer().notNull().default(0),
    added: integer().notNull().default(0),
    error: text(),
  },
  (t) => [index().on(t.startedAt)],
);

/** Per-source health and yield for each run: which boards are worth keeping. */
export const fetchRunSources = pgTable(
  "fetch_run_sources",
  {
    runId: uuid()
      .notNull()
      .references(() => fetchRuns.id, { onDelete: "cascade" }),
    source: text().notNull(),
    ok: boolean().notNull(),
    error: text(),
    fetched: integer().notNull().default(0),
    matched: integer().notNull().default(0),
    /** Postings dropped per filter stage: { eligibility: 120, relevance: 40, … }. */
    rejected: jsonb().$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.runId, t.source] })],
);

// ── Applications and what happened after ─────────────────────────────────────

export const resumeVersions = pgTable("resume_versions", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  url: text(),
  notes: text().notNull().default(""),
  isDefault: boolean().notNull().default(false),
  createdAt: timestamptz().notNull().defaultNow(),
});

export const applications = pgTable(
  "applications",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .unique()
      .references(() => jobs.id, { onDelete: "cascade" }),
    appliedAt: timestamptz().notNull().defaultNow(),
    channel: applicationChannelEnum().notNull(),
    resumeVersionId: uuid().references(() => resumeVersions.id, { onDelete: "set null" }),
    tailored: boolean().notNull().default(false),
    coverLetter: boolean().notNull().default(false),
    askedRate: text(),
    /** Derived from the events; stored so lists can filter on it. */
    status: applicationStatusEnum().notNull().default("applied"),
    /** Once you've read the full posting or asked: was it really open to you? */
    eligibilityCheck: eligibilityCheckEnum(),
    notes: text().notNull().default(""),
    updatedAt: timestamptz()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.appliedAt), index().on(t.status)],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    applicationId: uuid()
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    type: applicationEventTypeEnum().notNull(),
    occurredAt: timestamptz().notNull().defaultNow(),
    notes: text().notNull().default(""),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index().on(t.applicationId, t.occurredAt)],
);

// ── Effort ───────────────────────────────────────────────────────────────────

/** Each time you open a site from "Check by hand". */
export const sourceVisits = pgTable(
  "source_visits",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceId: text().notNull(),
    visitedAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index().on(t.sourceId, t.visitedAt)],
);

// ── Relations (for db.query) ─────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({ jobs: many(jobs) }));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  sightings: many(jobSightings),
  application: one(applications, { fields: [jobs.id], references: [applications.jobId] }),
}));

export const jobSightingsRelations = relations(jobSightings, ({ one }) => ({
  job: one(jobs, { fields: [jobSightings.jobId], references: [jobs.id] }),
}));

export const fetchRunsRelations = relations(fetchRuns, ({ many }) => ({ sources: many(fetchRunSources) }));

export const fetchRunSourcesRelations = relations(fetchRunSources, ({ one }) => ({
  run: one(fetchRuns, { fields: [fetchRunSources.runId], references: [fetchRuns.id] }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
  resumeVersion: one(resumeVersions, { fields: [applications.resumeVersionId], references: [resumeVersions.id] }),
  events: many(applicationEvents),
}));

export const applicationEventsRelations = relations(applicationEvents, ({ one }) => ({
  application: one(applications, { fields: [applicationEvents.applicationId], references: [applications.id] }),
}));
