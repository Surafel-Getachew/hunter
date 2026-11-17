import { profile } from "../config.ts";
import { getJson, sleep } from "../http.ts";
import type { Job, Salary } from "../types.ts";

interface JobgetherJob {
  id: string;
  title: string;
  company: string;
  url: string;
  /** Comma-separated regions and countries, e.g. "EMEA" or "Africa, Middle East, Kenya". */
  location: string;
  contractType: string;
  /** e.g. "60000-100000 USD", annual. */
  salaryRange?: string;
  postedAt: string;
}

interface Page {
  jobs?: JobgetherJob[];
  pagination?: { hasMore: boolean };
}

/** Developer job functions in Jobgether's taxonomy (unknown slugs are a 400). */
const JOB_FUNCTIONS = [
  "full-stack-engineer",
  "full-stack-developer",
  "software-engineer",
  "software-developer",
  "frontend-developer",
  "frontend-engineer",
  "backend-developer",
  "backend-engineer",
  "web-developer",
];

/** The API serves at most 10 pages of 25; a week is usually one or two. */
const MAX_PAGES = 10;
/** robots.txt asks for a two-second crawl delay. */
const CRAWL_DELAY_MS = 2000;

function parseSalary(range: string | undefined): Salary | undefined {
  const m = range?.match(/^(\d+)-(\d+)\s+([A-Z]{3})$/);
  if (!m) return undefined;
  return { min: Number(m[1]), max: Number(m[2]), period: "annual", currency: m[3]! };
}

/**
 * Jobgether's public search API, filtered to jobs it lists as open to someone in
 * Ethiopia (its location data is per country: "Anywhere", "EMEA", "Africa"…).
 * It gives no description, and its job pages refuse scripts, so these jobs are
 * judged by title alone. robots.txt allows this endpoint (`/astroapi/ai/jobs.json`).
 */
export async function fetchJobgether(): Promise<Job[]> {
  const cutoff = Date.now() - profile.maxAgeDays * 86_400_000;
  const jobs: Job[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(CRAWL_DELAY_MS);
    const params = new URLSearchParams({
      locations: "ethiopia",
      jobReferences: JOB_FUNCTIONS.join(","),
      sort: "date",
      limit: "25",
      page: String(page),
    });
    const data = await getJson<Page>(`https://jobgether.com/astroapi/ai/jobs.json?${params}`);
    const batch = data.jobs ?? [];
    for (const j of batch) {
      jobs.push({
        id: `jobgether:${j.id}`,
        source: "Jobgether",
        title: j.title,
        company: j.company,
        url: j.url,
        locations: j.location.split(/,\s*/).filter(Boolean),
        description: "",
        postedAt: j.postedAt ? new Date(j.postedAt) : null,
        employmentType: j.contractType || undefined,
        salary: parseSalary(j.salaryRange),
      });
    }
    const oldest = batch.at(-1)?.postedAt;
    if (!data.pagination?.hasMore || !oldest || Date.parse(oldest) < cutoff) break;
  }
  return jobs;
}
