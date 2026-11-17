import { profile, workableQueries } from "../config.ts";
import { getJson, sleep } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface WorkableJob {
  id: string;
  title: string;
  description: string;
  requirementsSection?: string;
  benefitsSection?: string;
  employmentType?: string;
  url: string;
  /** e.g. ["TELECOMMUTE", "Portugal"] — remote jobs are posted per country. */
  locations?: string[];
  location?: { city?: string; countryName?: string | null } | null;
  created: string;
  company?: { title?: string } | null;
}

interface SearchResponse {
  totalSize: number;
  nextPageToken?: string;
  jobs: WorkableJob[];
}

const MAX_PAGES_PER_QUERY = 10;

function toJob(j: WorkableJob): Job {
  const places = (j.locations ?? []).filter((l) => l !== "TELECOMMUTE");
  const country = j.location?.countryName;
  return {
    id: `workable:${j.id}`,
    source: "Workable",
    title: j.title,
    company: j.company?.title ?? "",
    url: j.url,
    // Prefer the country: city entries ("Kutaisi, Imereti, Georgia") add nothing for eligibility.
    locations: country ? [country] : places.length ? places : ["Remote"],
    // Benefits matter: "401(k)" or "medical, dental, vision" marks a US-payroll role.
    description: htmlToText([j.description, j.requirementsSection, j.benefitsSection].filter(Boolean).join("\n")),
    postedAt: new Date(j.created),
    employmentType: j.employmentType,
  };
}

/**
 * Workable's public job search covers every company hiring through Workable.
 * Remote jobs there are tied to a country, so most land in the US/Europe tier.
 */
export async function fetchWorkable(): Promise<Job[]> {
  const jobs = new Map<string, Job>();
  for (const query of workableQueries) {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
      const params = new URLSearchParams({ query, workplace: "remote", day_range: String(profile.maxAgeDays) });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await getJson<SearchResponse>(`https://jobs.workable.com/api/v1/jobs?${params}`);
      for (const j of data.jobs) jobs.set(j.id, toJob(j));
      pageToken = data.nextPageToken;
      if (!pageToken || data.jobs.length === 0) break;
      await sleep(300);
    }
  }
  return [...jobs.values()];
}
