// Everything you record by hand: saving, hiding, applying, what happened after,
// CV versions and site visits. Each takes the database so tests can use PGlite.
import { and, asc, eq, ne } from "drizzle-orm";
import type { Database } from "../../db/index.ts";
import { applicationEvents, applications, companies, jobs, resumeVersions, sourceVisits } from "../../db/schema.ts";
import { deriveStatus } from "./funnel.ts";
import { normalizeCompany } from "./ingest.ts";
import { MANUAL_SOURCES } from "./manual-sources.ts";
import type {
  ApplicationChannel,
  CompanyKind,
  EligibilityCheck,
  EventType,
  SkipReason,
} from "./model.ts";
import { dedupeKey } from "./text.ts";
import type { Eligibility } from "./types.ts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;

export class NotFoundError extends Error {}

async function requireJob(db: Db, jobId: string): Promise<void> {
  const [row] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!row) throw new NotFoundError("That job no longer exists.");
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function setSaved(db: Database, jobId: string, saved: boolean, now = new Date()): Promise<void> {
  await requireJob(db, jobId);
  await db.update(jobs).set({ savedAt: saved ? now : null }).where(eq(jobs.id, jobId));
}

export async function hideJob(db: Database, jobId: string, reason: SkipReason, note: string | null, now = new Date()): Promise<void> {
  await requireJob(db, jobId);
  await db.update(jobs).set({ hiddenAt: now, skipReason: reason, skipNote: note || null, savedAt: null }).where(eq(jobs.id, jobId));
}

export async function unhideJob(db: Database, jobId: string): Promise<void> {
  await db.update(jobs).set({ hiddenAt: null, skipReason: null, skipNote: null }).where(eq(jobs.id, jobId));
}

export async function setCompanyKind(db: Database, companyId: string, kind: CompanyKind): Promise<void> {
  await db.update(companies).set({ kind }).where(eq(companies.id, companyId));
}

// ── Applications ─────────────────────────────────────────────────────────────

export interface ApplyInput {
  channel: ApplicationChannel;
  appliedAt?: Date;
  /** Omitted: the default CV version, if one is set. */
  resumeVersionId?: string | null;
  tailored?: boolean;
  coverLetter?: boolean;
}

async function defaultResumeId(db: Db): Promise<string | null> {
  const [row] = await db.select({ id: resumeVersions.id }).from(resumeVersions).where(eq(resumeVersions.isDefault, true)).limit(1);
  return row?.id ?? null;
}

/** Records an application and its "applied" event. Applying un-hides and un-saves the job. */
export async function applyToJob(db: Database, jobId: string, input: ApplyInput): Promise<string> {
  return db.transaction(async (tx) => {
    await requireJob(tx, jobId);
    const appliedAt = input.appliedAt ?? new Date();
    const resumeVersionId = input.resumeVersionId === undefined ? await defaultResumeId(tx) : input.resumeVersionId;
    const [app] = await tx
      .insert(applications)
      .values({
        jobId,
        appliedAt,
        channel: input.channel,
        resumeVersionId,
        tailored: input.tailored ?? false,
        coverLetter: input.coverLetter ?? false,
      })
      .onConflictDoNothing({ target: applications.jobId })
      .returning({ id: applications.id });
    if (!app) throw new Error("You've already applied to this job.");
    await tx.insert(applicationEvents).values({ applicationId: app.id, type: "applied", occurredAt: appliedAt });
    await tx.update(jobs).set({ hiddenAt: null, skipReason: null, skipNote: null, savedAt: null }).where(eq(jobs.id, jobId));
    return app.id;
  });
}

export interface ManualJobInput {
  company: string;
  title: string;
  url: string;
  source: string;
  eligibility: Eligibility;
  postedAt?: Date | null;
}

/**
 * A job found outside the fetch (LinkedIn, a referral…), applied to right away.
 * If the fetch already has the same posting, the application attaches to it.
 */
export async function addManualApplication(db: Database, job: ManualJobInput, apply: ApplyInput): Promise<string> {
  const key = dedupeKey(job.company, job.title);
  const jobId = await db.transaction(async (tx) => {
    const normalizedName = normalizeCompany(job.company);
    await tx.insert(companies).values({ name: job.company.trim(), normalizedName }).onConflictDoNothing();
    const [company] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.normalizedName, normalizedName));
    const [row] = await tx
      .insert(jobs)
      .values({
        dedupeKey: key,
        companyId: company!.id,
        title: job.title.trim(),
        url: job.url.trim(),
        source: job.source,
        eligibility: job.eligibility,
        eligibilityReason: `Added by hand from ${job.source}`,
        postedAt: job.postedAt ?? null,
        addedManually: true,
      })
      .onConflictDoUpdate({ target: jobs.dedupeKey, set: { lastSeenAt: new Date() } })
      .returning({ id: jobs.id });
    return row!.id;
  });
  return applyToJob(db, jobId, apply);
}

async function recomputeStatus(db: Db, applicationId: string): Promise<void> {
  const events = await db
    .select({ type: applicationEvents.type, occurredAt: applicationEvents.occurredAt })
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId));
  await db.update(applications).set({ status: deriveStatus(events) }).where(eq(applications.id, applicationId));
}

export async function addEvent(
  db: Database,
  applicationId: string,
  event: { type: EventType; occurredAt?: Date; notes?: string },
): Promise<void> {
  if (event.type === "applied") throw new Error("An application already has its “applied” event.");
  await db.transaction(async (tx) => {
    const [app] = await tx.select({ id: applications.id }).from(applications).where(eq(applications.id, applicationId));
    if (!app) throw new NotFoundError("That application no longer exists.");
    await tx.insert(applicationEvents).values({
      applicationId,
      type: event.type,
      occurredAt: event.occurredAt ?? new Date(),
      notes: event.notes ?? "",
    });
    await recomputeStatus(tx, applicationId);
  });
}

/** Removes a mistaken event. The "applied" event stays; delete the application instead. */
export async function deleteEvent(db: Database, eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(applicationEvents)
      .where(and(eq(applicationEvents.id, eventId), ne(applicationEvents.type, "applied")))
      .returning({ applicationId: applicationEvents.applicationId });
    if (deleted) await recomputeStatus(tx, deleted.applicationId);
  });
}

export interface ApplicationPatch {
  channel?: ApplicationChannel;
  resumeVersionId?: string | null;
  tailored?: boolean;
  coverLetter?: boolean;
  askedRate?: string | null;
  eligibilityCheck?: EligibilityCheck | null;
  notes?: string;
}

export async function updateApplication(db: Database, applicationId: string, patch: ApplicationPatch): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(applications).set(patch).where(eq(applications.id, applicationId));
}

/** Undo "Applied". The job goes back to the list. */
export async function deleteApplication(db: Database, applicationId: string): Promise<void> {
  await db.delete(applications).where(eq(applications.id, applicationId));
}

// ── CV versions ──────────────────────────────────────────────────────────────

export async function createResumeVersion(
  db: Database,
  input: { name: string; url?: string | null; notes?: string; makeDefault?: boolean },
): Promise<string> {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: resumeVersions.id }).from(resumeVersions).limit(1);
    const makeDefault = input.makeDefault || existing.length === 0;
    if (makeDefault) await tx.update(resumeVersions).set({ isDefault: false });
    const [row] = await tx
      .insert(resumeVersions)
      .values({ name: input.name.trim(), url: input.url || null, notes: input.notes ?? "", isDefault: makeDefault })
      .returning({ id: resumeVersions.id });
    return row!.id;
  });
}

export async function setDefaultResume(db: Database, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(resumeVersions).set({ isDefault: false });
    await tx.update(resumeVersions).set({ isDefault: true }).where(eq(resumeVersions.id, id));
  });
}

export async function listResumeVersions(db: Database) {
  return db.select().from(resumeVersions).orderBy(asc(resumeVersions.createdAt));
}

// ── Effort ───────────────────────────────────────────────────────────────────

export async function recordVisit(db: Database, sourceId: string, now = new Date()): Promise<void> {
  if (!MANUAL_SOURCES.some((s) => s.id === sourceId)) throw new Error(`Unknown site: ${sourceId}`);
  await db.insert(sourceVisits).values({ sourceId, visitedAt: now });
}
