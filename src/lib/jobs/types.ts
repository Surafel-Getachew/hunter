/**
 * open: worldwide/Africa/Ethiopia · likely: EMEA or a compatible time zone ·
 * unknown: just "Remote" · possible: listed for US/Europe with no residency or
 * citizenship requirement stated · restricted: excluded.
 */
export type Eligibility = "open" | "likely" | "unknown" | "possible" | "restricted";

export type SalaryPeriod = "annual" | "monthly" | "hourly";

export interface Salary {
  min: number | null;
  max: number | null;
  period: SalaryPeriod;
  currency: string;
}

export interface Job {
  /** Stable id within the source, e.g. "himalayas:https://..." */
  id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  /** Raw location / eligibility text as the source states it. */
  locations: string[];
  /** Plain-text description (HTML stripped). */
  description: string;
  postedAt: Date | null;
  employmentType?: string;
  salary?: Salary;
  /**
   * Set when the source itself has already filtered by our country
   * (e.g. Himalayas' country search), so eligibility is structured data
   * rather than something we infer from text.
   */
  eligibilityHint?: Eligibility;
}

/** "main" = full-stack roles toward the goal; "ai-training" = part-time AI-training contracts. */
export type JobCategory = "main" | "ai-training";

export interface ScoredJob extends Job {
  category: JobCategory;
  eligibility: Eligibility;
  eligibilityReason: string;
  score: number;
  matchedSkills: string[];
}

export interface Source {
  name: string;
  fetch: () => Promise<Job[]>;
}
