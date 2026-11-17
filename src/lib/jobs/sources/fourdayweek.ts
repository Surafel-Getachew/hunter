import { profile } from "../config.ts";
import { getJson } from "../http.ts";
import type { Job } from "../types.ts";

/** The API leaves out empty fields: 2 of 100 jobs had no `locations` (2026-11-17). */
interface FourDayWeekJob {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  contract_type?: string | null;
  locations?: { country?: string | null; continent?: string | null }[] | null;
  posted_at?: string | null;
  company?: { name: string } | null;
}

interface Page {
  data: FourDayWeekJob[];
  has_more: boolean;
}

/** About 200 remote engineering postings a week; the API allows 60 requests a minute. */
const MAX_PAGES = 5;

/**
 * 4dayweek.io's free API, which collects postings from company career pages.
 * Its `country` filter only matches listed countries, so Ethiopia returns
 * nothing; the eligibility filter reads the locations instead. Its terms ask for
 * a link back, which `url` is.
 */
export async function fetchFourDayWeek(): Promise<Job[]> {
  const jobs: Job[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      work_arrangement: "remote",
      category: "engineering",
      posted_after: String(profile.maxAgeDays),
      limit: "100",
      page: String(page),
    });
    const data = await getJson<Page>(`https://4dayweek.io/api/v2/jobs?${params}`);
    for (const j of data.data) {
      jobs.push({
        id: `4dayweek:${j.id}`,
        source: "4dayweek",
        title: j.title,
        company: j.company?.name ?? "Unknown",
        url: j.url,
        locations: [...new Set((j.locations ?? []).map((l) => l.country || l.continent).filter((l): l is string => !!l))],
        description: j.description ?? "",
        postedAt: j.posted_at ? new Date(j.posted_at) : null,
        employmentType: j.contract_type?.replace(/_/g, " ") ?? undefined,
      });
    }
    if (!data.has_more) break;
  }
  return jobs;
}
