// Job-list filters, kept in the URL so a filtered view survives reloads and can
// be bookmarked. Pure and client-safe.
import type { Eligibility, JobCategory } from "./types.ts";

export const JOB_VIEWS = ["new", "saved", "hidden", "all"] as const;
export type JobView = (typeof JOB_VIEWS)[number];

export const VISIBLE_TIERS = ["open", "likely", "unknown", "possible"] as const satisfies readonly Eligibility[];

export const POSTED_WITHIN = [
  { value: "any", label: "Any time", hours: null },
  { value: "12", label: "Last 12 hours", hours: 12 },
  { value: "24", label: "Last 24 hours", hours: 24 },
  { value: "72", label: "Last 3 days", hours: 72 },
  { value: "168", label: "Last 7 days", hours: 168 },
] as const;

export type Section = "all" | JobCategory;
export type SortOrder = "best" | "newest";

export interface JobFilters {
  view: JobView;
  query: string;
  section: Section;
  tiers: Eligibility[];
  postedWithinHours: number | null;
  source: string;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: JobFilters = {
  view: "new",
  query: "",
  section: "all",
  tiers: [...VISIBLE_TIERS],
  postedWithinHours: null,
  source: "all",
  sort: "best",
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(params: Params): JobFilters {
  const view = one(params.view);
  const section = one(params.section);
  const sort = one(params.sort);
  const tiers = one(params.tiers)
    ?.split(",")
    .filter((t): t is Eligibility => (VISIBLE_TIERS as readonly string[]).includes(t));
  const within = POSTED_WITHIN.find((p) => p.value === one(params.within));
  return {
    view: JOB_VIEWS.includes(view as JobView) ? (view as JobView) : DEFAULT_FILTERS.view,
    query: (one(params.q) ?? "").slice(0, 200),
    section: section === "main" || section === "ai-training" ? section : "all",
    tiers: tiers?.length ? tiers : DEFAULT_FILTERS.tiers,
    postedWithinHours: within?.hours ?? null,
    source: one(params.source) || "all",
    sort: sort === "newest" ? "newest" : "best",
  };
}

/** Only non-default values, so URLs stay short. */
export function filtersToSearch(filters: JobFilters): string {
  const p = new URLSearchParams();
  if (filters.view !== DEFAULT_FILTERS.view) p.set("view", filters.view);
  if (filters.query) p.set("q", filters.query);
  if (filters.section !== "all") p.set("section", filters.section);
  if (filters.tiers.length !== VISIBLE_TIERS.length) p.set("tiers", filters.tiers.join(","));
  if (filters.postedWithinHours) p.set("within", String(filters.postedWithinHours));
  if (filters.source !== "all") p.set("source", filters.source);
  if (filters.sort !== "best") p.set("sort", filters.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}
