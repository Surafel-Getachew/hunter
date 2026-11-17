import { profile } from "../config.ts";
import type { Eligibility, Job, JobCategory, ScoredJob } from "../types.ts";
import { isAiTrainingRole } from "./ai-training.ts";
import { classifyJob } from "./eligibility.ts";
import { assessRelevance } from "./relevance.ts";
import { annualUsdCeiling } from "./salary.ts";

export type Verdict = { keep: true; job: ScoredJob } | { keep: false; stage: string; reason: string };

export interface EvaluateOptions {
  now?: Date;
  /** Only keep postings from the last N hours (postings without a date are dropped). */
  maxAgeHours?: number;
}

const HOUR_MS = 3_600_000;

/** Confirmed-open jobs rank first; US/Europe-listed ones rank on stack fit alone. */
const ELIGIBILITY_POINTS: Record<Eligibility, number> = { open: 4, likely: 2, unknown: 1, possible: 0, restricted: 0 };

function ageCheck(job: Job, now: Date, maxAgeHours: number | undefined): string | null {
  if (maxAgeHours != null) {
    if (!job.postedAt) return "no posting date";
    if (now.getTime() - job.postedAt.getTime() > maxAgeHours * HOUR_MS) return `older than ${maxAgeHours}h`;
    return null;
  }
  if (job.postedAt && now.getTime() - job.postedAt.getTime() > profile.maxAgeDays * 24 * HOUR_MS) {
    return `older than ${profile.maxAgeDays} days`;
  }
  return null;
}

export function evaluate(job: Job, { now = new Date(), maxAgeHours }: EvaluateOptions = {}): Verdict {
  const tooOld = ageCheck(job, now, maxAgeHours);
  if (tooOld) return { keep: false, stage: "age", reason: tooOld };

  const eligibility = classifyJob(job);
  if (eligibility.status === "restricted") return { keep: false, stage: "eligibility", reason: eligibility.reason };
  if (
    (eligibility.status === "unknown" && !profile.includeUnknownEligibility) ||
    (eligibility.status === "possible" && !profile.includeWesternListed)
  ) {
    return { keep: false, stage: "eligibility", reason: eligibility.reason };
  }

  const relevance = assessRelevance(job);
  let category: JobCategory = "main";
  if (profile.includeAiTraining && isAiTrainingRole(job)) {
    // AI-training platforms verify residency for country-specific contracts.
    if (eligibility.status === "possible") {
      return { keep: false, stage: "eligibility", reason: `AI-training contract for ${eligibility.reason}` };
    }
    category = "ai-training";
  } else if (!relevance.relevant) {
    return { keep: false, stage: "relevance", reason: relevance.reason };
  }

  // AI-training work is part-time bridge income; the monthly floor is for the main search.
  const ceiling = annualUsdCeiling(job.salary);
  if (category === "main" && ceiling != null && ceiling < profile.minAnnualUsd) {
    return { keep: false, stage: "salary", reason: `tops out at ~$${Math.round(ceiling).toLocaleString("en-US")}/yr` };
  }

  let score = Math.min(relevance.skillScore, 12);
  score += ELIGIBILITY_POINTS[eligibility.status];
  if (ceiling != null) score += 2;
  if (/\b(senior|sr\.?|lead|staff)\b/i.test(job.title)) score += 1;
  if (job.postedAt) {
    const ageDays = (now.getTime() - job.postedAt.getTime()) / (24 * HOUR_MS);
    score += ageDays <= 3 ? 2 : ageDays <= 7 ? 1 : 0;
  }

  // AI-training roles are often Python-centric, so they rank on their own scale. The
  // floor measures stack fit, which a posting without a description can't show.
  if (category === "main" && !relevance.titleOnly && score < profile.minScore) {
    return { keep: false, stage: "score", reason: `score ${score}` };
  }

  return {
    keep: true,
    job: {
      ...job,
      category,
      eligibility: eligibility.status,
      eligibilityReason: eligibility.reason,
      score,
      matchedSkills: relevance.matchedSkills,
    },
  };
}
