import { arcCategories, profile } from "../config.ts";
import { WESTERN_COUNTRY_CODES } from "../filters/eligibility.ts";
import { getText, sleep } from "../http.ts";
import { decodeEntities } from "../text.ts";
import type { Eligibility, Job, Salary } from "../types.ts";

interface ArcCategory {
  name: string;
}

/** Jobs posted through Arc itself (HireAI). */
interface ArcJob {
  randomKey: string;
  title: string;
  jobType: string;
  requiredCountries: string[];
  minAnnualSalary: number | null;
  maxAnnualSalary: number | null;
  minHourlyRate: number | null;
  maxHourlyRate: number | null;
  overlapHours: number | null;
  timeZone: string | null;
  urlString: string;
  postedAt: number;
  company: { name?: string } | null;
  categories: ArcCategory[];
}

/** Jobs Arc aggregates from company career pages. */
interface ArcExternalJob {
  randomKey: string;
  title: string;
  jobType: string;
  requiredCountries: string[];
  urlString: string;
  postedAt: number;
  company: { name?: string } | null;
  categories: ArcCategory[];
}

interface ArcPageProps {
  arcJobs?: ArcJob[];
  externalJobs?: ArcExternalJob[];
}

const NEXT_DATA = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

/** Arc lists the countries a job accepts; an empty list means anywhere. */
function eligibilityFor(countries: string[]): Eligibility {
  if (countries.length === 0 || countries.includes(profile.country.code)) return "open";
  return countries.every((c) => WESTERN_COUNTRY_CODES.has(c)) ? "possible" : "restricted";
}

function locationLabel(countries: string[]): string {
  if (countries.length === 0) return "Worldwide";
  if (countries.includes(profile.country.code)) return `${countries.length} countries incl. ${profile.country.name}`;
  return countries.slice(0, 5).join(", ") + (countries.length > 5 ? "…" : "");
}

function salaryFor(j: ArcJob): Salary | undefined {
  if (j.minHourlyRate || j.maxHourlyRate) {
    return { min: j.minHourlyRate, max: j.maxHourlyRate, period: "hourly", currency: "USD" };
  }
  if (j.minAnnualSalary || j.maxAnnualSalary) {
    return { min: j.minAnnualSalary, max: j.maxAnnualSalary, period: "annual", currency: "USD" };
  }
  return undefined;
}

const jobTypeLabel = (type: string) => (type === "permanent" ? "Full Time" : type === "contract" ? "Contract" : type);

/**
 * Arc's category pages embed their newest jobs as JSON (no description, but
 * skills and allowed countries are structured). Pages don't paginate, so a
 * daily run picks up each category's latest postings.
 */
export async function fetchArc(): Promise<Job[]> {
  const jobs = new Map<string, Job>();
  for (const category of arcCategories) {
    const html = await getText(`https://arc.dev/remote-jobs/${category}`);
    const json = html.match(NEXT_DATA)?.[1];
    if (!json) throw new Error(`Arc page layout changed (no __NEXT_DATA__ on /${category})`);
    const props = (JSON.parse(json) as { props?: { pageProps?: ArcPageProps } }).props?.pageProps ?? {};

    for (const j of props.arcJobs ?? []) {
      const skills = j.categories.map((c) => c.name).join(", ");
      const overlap = j.overlapHours ? ` · ${j.overlapHours}h overlap with ${j.timeZone ?? "client"}` : "";
      jobs.set(j.randomKey, {
        id: `arc:${j.randomKey}`,
        source: "Arc",
        title: decodeEntities(j.title.trim()),
        company: j.company?.name ?? "Arc client",
        url: `https://arc.dev/remote-jobs/details/${j.urlString}-${j.randomKey}`,
        locations: [locationLabel(j.requiredCountries) + overlap],
        description: `Skills: ${skills}`,
        postedAt: new Date(j.postedAt * 1000),
        employmentType: jobTypeLabel(j.jobType),
        salary: salaryFor(j),
        eligibilityHint: eligibilityFor(j.requiredCountries),
      });
    }
    for (const j of props.externalJobs ?? []) {
      jobs.set(j.randomKey, {
        id: `arc:${j.randomKey}`,
        source: "Arc",
        title: decodeEntities(j.title.trim()),
        company: j.company?.name ?? "",
        url: `https://arc.dev/remote-jobs/j/${j.urlString}-${j.randomKey}`,
        locations: [locationLabel(j.requiredCountries)],
        description: `Skills: ${j.categories.map((c) => c.name).join(", ")}`,
        postedAt: new Date(j.postedAt * 1000),
        employmentType: jobTypeLabel(j.jobType),
        eligibilityHint: eligibilityFor(j.requiredCountries),
      });
    }
    await sleep(500);
  }
  return [...jobs.values()];
}
