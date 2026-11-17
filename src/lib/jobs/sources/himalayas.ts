import { himalayasQueries, profile } from "../config.ts";
import { getJson, postForText, sleep } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job, SalaryPeriod } from "../types.ts";

interface HimalayasJob {
  guid: string;
  title: string;
  companyName: string;
  employmentType: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  salaryPeriod: string | null;
  currency: string | null;
  locationRestrictions: string[];
  description: string;
  /** When Himalayas last refreshed the posting, not when it went up (see fetchHimalayas). */
  pubDate: number;
  applicationLink: string;
}

interface SearchResponse {
  totalCount: number;
  limit: number;
  jobs: HimalayasJob[];
}

/** Each query has at most ~200 results (2026-11-02), 20 to a page. */
const MAX_PAGES_PER_QUERY = 25;

/** At 300 ms apart, Cloudflare blocked the ~35-request read after about 20 requests (2026-11-17). */
const PAGE_DELAY_MS = 1000;

const MCP_URL = "https://mcp.himalayas.app/mcp";

/**
 * Without a Himalayas account the MCP server allows 30 lookups a minute and 200
 * a day per network (2026-11-17). A run reads only back to the age cutoff,
 * usually one or two pages per query, so 10–15 lookups.
 */
const MCP_DELAY_MS = 2500;

const DAY_MS = 86_400_000;

/** One job in Himalayas' MCP search results. */
export interface McpListing {
  /** Same form as the REST API's `guid`. */
  guid: string;
  /** The day the job was posted (UTC midnight), as its job page shows it. */
  postedOn: Date;
}

/**
 * Parses a `search_jobs` result. The MCP server answers in Markdown meant for
 * assistants; each job has a "📅 Posted YYYY-MM-DD" line and a
 * `🆔 company_slug "…", job_slug "…"` line, and jobs are separated by `---`.
 */
export function parseMcpSearch(text: string): { total: number | null; listings: McpListing[] } {
  const total = text.match(/^Found (\d+) jobs?/m);
  const listings: McpListing[] = [];
  for (const block of text.split(/\n-{3,}\n/)) {
    const id = block.match(/🆔 company_slug "([^"]+)", job_slug "([^"]+)"/);
    const posted = block.match(/📅 Posted (\d{4}-\d{2}-\d{2})/);
    if (!id || !posted) continue;
    listings.push({ guid: `https://himalayas.app/companies/${id[1]}/jobs/${id[2]}`, postedOn: new Date(`${posted[1]}T00:00:00Z`) });
  }
  return { total: total ? Number(total[1]) : null, listings };
}

async function searchMcp(query: string, page: number): Promise<string> {
  const raw = await postForText(
    MCP_URL,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "search_jobs", arguments: { keyword: query, country: profile.country.code, sort: "recent", page } },
    },
    { Accept: "application/json, text/event-stream" },
  );
  // Streamable HTTP answers either as JSON or as one server-sent event.
  const json = raw.trimStart().startsWith("{") ? raw : raw.match(/^data: (.*)$/m)?.[1];
  if (!json) throw new Error(`Himalayas MCP: unexpected response for "${query}"`);
  const message = JSON.parse(json) as {
    result?: { isError?: boolean; content?: { type: string; text?: string }[] };
    error?: { message: string };
  };
  const text = message.result?.content?.find((c) => c.type === "text")?.text;
  if (message.error || message.result?.isError || text == null) {
    throw new Error(`Himalayas MCP search failed for "${query}": ${message.error?.message ?? text ?? "no content"}`);
  }
  return text;
}

/**
 * Real posting days by guid, from the MCP search (the REST search's dates are
 * refresh dates). Its "recent" sort is by that day, so each query is read only
 * until it passes `since`: every job posted since then is in the map.
 */
async function fetchPostingDays(since: Date): Promise<Map<string, Date>> {
  const days = new Map<string, Date>();
  let first = true;
  for (const q of himalayasQueries) {
    for (let page = 1; page <= MAX_PAGES_PER_QUERY; page++) {
      if (!first) await sleep(MCP_DELAY_MS);
      first = false;
      const { total, listings } = parseMcpSearch(await searchMcp(q, page));
      for (const l of listings) days.set(l.guid, l.postedOn);
      const last = listings.at(-1);
      if (!last || last.postedOn < since || (total != null && page * 20 >= total)) break;
    }
  }
  return days;
}

/** The REST search: the job data, filtered to jobs open to applicants in our country. */
async function fetchListings(): Promise<Map<string, HimalayasJob>> {
  const jobs = new Map<string, HimalayasJob>();
  let first = true;
  for (const q of himalayasQueries) {
    for (let page = 1; page <= MAX_PAGES_PER_QUERY; page++) {
      if (!first) await sleep(PAGE_DELAY_MS);
      first = false;
      const params = new URLSearchParams({ q, country: profile.country.code, sort: "recent", page: String(page) });
      const data = await getJson<SearchResponse>(`https://himalayas.app/jobs/api/search?${params}`);
      for (const j of data.jobs) jobs.set(j.guid, j);
      if (data.jobs.length === 0 || page * data.limit >= data.totalCount) break;
    }
  }
  return jobs;
}

/**
 * The posting date. The REST `pubDate` (and `expiryDate`) is reset whenever
 * Himalayas re-checks a job, so jobs from September showed as hours old. The
 * MCP day is the real one; the REST timestamp is kept only when it falls on
 * that same day, which makes it the original time.
 */
export function postingDate(pubDate: number | null | undefined, postedOn: Date | undefined): Date | null {
  if (!postedOn) return null;
  const refreshed = pubDate ? new Date(pubDate * 1000) : null;
  const sameDay = refreshed && refreshed.getTime() >= postedOn.getTime() && refreshed.getTime() < postedOn.getTime() + DAY_MS;
  return sameDay ? refreshed : postedOn;
}

function toJob(j: HimalayasJob, postedOn: Date | undefined): Job {
  const period: SalaryPeriod = j.salaryPeriod === "hourly" ? "hourly" : j.salaryPeriod === "monthly" ? "monthly" : "annual";
  return {
    id: `himalayas:${j.guid}`,
    source: "Himalayas",
    title: j.title,
    company: j.companyName,
    url: j.applicationLink || j.guid,
    locations: j.locationRestrictions.length ? j.locationRestrictions : ["Worldwide"],
    description: htmlToText(j.description ?? ""),
    postedAt: postingDate(j.pubDate, postedOn),
    employmentType: j.employmentType ?? undefined,
    salary:
      j.minSalary != null || j.maxSalary != null
        ? { min: j.minSalary, max: j.maxSalary, period, currency: j.currency ?? "USD" }
        : undefined,
    // The search is already filtered to jobs that accept our country.
    eligibilityHint: "open",
  };
}

/**
 * Himalayas' search filters by the applicant's country, so everything returned
 * accepts Ethiopia. Job data comes from the REST API and posting dates from the
 * MCP server (separate hosts, read side by side). A job the MCP search didn't
 * list was posted before the age cutoff, so it is left out, as the age filter
 * would do with its real date.
 */
export async function fetchHimalayas(): Promise<Job[]> {
  // A day's margin: the MCP gives days, not times.
  const since = new Date(Date.now() - (profile.maxAgeDays + 1) * DAY_MS);
  const [listings, days] = await Promise.all([fetchListings(), fetchPostingDays(since)]);
  if (listings.size > 0 && days.size === 0) {
    throw new Error("Himalayas MCP search gave no posting dates; its response format may have changed (see parseMcpSearch)");
  }
  return [...listings.values()].filter((j) => days.has(j.guid)).map((j) => toJob(j, days.get(j.guid)));
}
