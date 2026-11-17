import { getJson } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface RemoteFirstJob {
  id: string;
  url: string;
  company_name: string;
  title: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  /** Up to three countries; empty when the posting names none. */
  locations: string[];
  published_at: string;
}

/** The free API serves at most five pages of 100, a day after publication. */
const MAX_PAGES = 5;

/**
 * Remote First Jobs (formerly JobsCollider), which collects remote postings from
 * company career pages. Its terms ask for credit and a link to the posting on
 * its site, which `url` is.
 */
export async function fetchRemoteFirstJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await getJson<{ jobs?: RemoteFirstJob[] }>(
      `https://remotefirstjobs.com/api/search-jobs?category=software-development&page=${page}`,
    );
    if (!data.jobs?.length) break;
    for (const j of data.jobs) {
      const locations = j.locations.filter(Boolean);
      jobs.push({
        id: `remotefirstjobs:${j.id}`,
        source: "Remote First Jobs",
        title: j.title,
        company: j.company_name,
        url: j.url,
        locations: locations.length ? locations : ["Remote"],
        description: htmlToText(j.description ?? ""),
        // Timestamps come without a zone and are UTC.
        postedAt: j.published_at ? new Date(`${j.published_at.replace(/Z$/, "")}Z`) : null,
        salary:
          j.salary_min != null || j.salary_max != null
            ? { min: j.salary_min, max: j.salary_max, period: "annual", currency: "USD" }
            : undefined,
      });
    }
  }
  return jobs;
}
