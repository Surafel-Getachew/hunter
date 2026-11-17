"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireUser } from "@/lib/dal";
import {
  APPLICATION_CHANNELS,
  COMPANY_KINDS,
  ELIGIBILITY_CHECKS,
  EVENT_TYPES,
  MANUAL_JOB_SOURCES,
  SKIP_REASONS,
} from "@/lib/jobs/model";
import { refreshJobs, type FetchSummary } from "@/lib/jobs/refresh";
import * as tracking from "@/lib/jobs/tracking";
import { VISIBLE_TIERS } from "@/lib/jobs/view";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Signed-in check, then the work, then refresh the pages whose data changed. */
async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await requireUser();
    const data = await work();
    for (const path of ["/", "/applications", "/dashboard", "/check", "/settings"]) revalidatePath(path);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid input." };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const id = z.uuid({ message: "Invalid id." });
const optionalDate = z.iso.datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined));

export async function fetchNow(): Promise<ActionResult<FetchSummary>> {
  return run(() => refreshJobs(db, { trigger: "manual" }));
}

export async function saveJob(jobId: string, saved: boolean): Promise<ActionResult> {
  return run(async () => {
    await tracking.setSaved(db, id.parse(jobId), z.boolean().parse(saved));
    return null;
  });
}

const hideInput = z.object({ reason: z.enum(SKIP_REASONS), note: z.string().max(500).optional() });

export async function hideJob(jobId: string, input: z.input<typeof hideInput>): Promise<ActionResult> {
  return run(async () => {
    const { reason, note } = hideInput.parse(input);
    await tracking.hideJob(db, id.parse(jobId), reason, note ?? null);
    return null;
  });
}

export async function unhideJob(jobId: string): Promise<ActionResult> {
  return run(async () => {
    await tracking.unhideJob(db, id.parse(jobId));
    return null;
  });
}

const applyInput = z.object({
  channel: z.enum(APPLICATION_CHANNELS),
  appliedAt: optionalDate,
  resumeVersionId: id.nullable().optional(),
  tailored: z.boolean().default(false),
  coverLetter: z.boolean().default(false),
});
export type ApplyFormInput = z.input<typeof applyInput>;

export async function applyToJob(jobId: string, input: ApplyFormInput): Promise<ActionResult> {
  return run(async () => {
    await tracking.applyToJob(db, id.parse(jobId), applyInput.parse(input));
    return null;
  });
}

const manualJobInput = z.object({
  company: z.string().trim().min(1, "Company is required.").max(200),
  title: z.string().trim().min(1, "Job title is required.").max(300),
  url: z.url({ message: "Enter the posting's link." }).max(2000),
  source: z.enum(MANUAL_JOB_SOURCES),
  eligibility: z.enum(VISIBLE_TIERS),
});
export type ManualApplicationInput = z.input<typeof manualJobInput> & ApplyFormInput;

/** A job you found yourself (LinkedIn, a referral…) and applied to. */
export async function logManualApplication(input: ManualApplicationInput): Promise<ActionResult> {
  return run(async () => {
    const job = manualJobInput.parse(input);
    await tracking.addManualApplication(db, job, applyInput.parse(input));
    return null;
  });
}

const eventInput = z.object({
  type: z.enum(EVENT_TYPES).exclude(["applied"]),
  occurredAt: optionalDate,
  notes: z.string().max(5000).optional(),
});

export async function addApplicationEvent(applicationId: string, input: z.input<typeof eventInput>): Promise<ActionResult> {
  return run(async () => {
    await tracking.addEvent(db, id.parse(applicationId), eventInput.parse(input));
    return null;
  });
}

export async function removeApplicationEvent(eventId: string): Promise<ActionResult> {
  return run(async () => {
    await tracking.deleteEvent(db, id.parse(eventId));
    return null;
  });
}

const applicationPatch = z
  .object({
    channel: z.enum(APPLICATION_CHANNELS),
    resumeVersionId: id.nullable(),
    tailored: z.boolean(),
    coverLetter: z.boolean(),
    askedRate: z.string().trim().max(100).nullable(),
    eligibilityCheck: z.enum(ELIGIBILITY_CHECKS).nullable(),
    notes: z.string().max(10_000),
  })
  .partial();

export async function updateApplicationDetails(
  applicationId: string,
  patch: z.input<typeof applicationPatch>,
): Promise<ActionResult> {
  return run(async () => {
    await tracking.updateApplication(db, id.parse(applicationId), applicationPatch.parse(patch));
    return null;
  });
}

export async function removeApplication(applicationId: string): Promise<ActionResult> {
  return run(async () => {
    await tracking.deleteApplication(db, id.parse(applicationId));
    return null;
  });
}

export async function setCompanyKind(companyId: string, kind: string): Promise<ActionResult> {
  return run(async () => {
    await tracking.setCompanyKind(db, id.parse(companyId), z.enum(COMPANY_KINDS).parse(kind));
    return null;
  });
}

const resumeInput = z.object({
  name: z.string().trim().min(1, "Give the version a name.").max(100),
  url: z.union([z.url({ message: "Enter a valid link, or leave it empty." }), z.literal("")]).optional(),
  notes: z.string().max(2000).optional(),
  makeDefault: z.boolean().optional(),
});

export async function addResumeVersion(input: z.input<typeof resumeInput>): Promise<ActionResult> {
  return run(async () => {
    await tracking.createResumeVersion(db, resumeInput.parse(input));
    return null;
  });
}

export async function makeResumeDefault(resumeId: string): Promise<ActionResult> {
  return run(async () => {
    await tracking.setDefaultResume(db, id.parse(resumeId));
    return null;
  });
}

export async function visitSource(sourceId: string): Promise<ActionResult> {
  return run(async () => {
    await tracking.recordVisit(db, z.string().max(100).parse(sourceId));
    return null;
  });
}
