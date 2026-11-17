import { atsBoards, type AtsBoard } from "../config.ts";
import { getJson } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

const REMOTE_HINT = /\b(remote|home[- ]based|anywhere|worldwide|distributed)\b/i;

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  first_published?: string;
  location: { name: string };
  content?: string;
}

async function fetchGreenhouse(board: AtsBoard): Promise<Job[]> {
  const data = await getJson<{ jobs: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs?content=true`,
  );
  return data.jobs
    .filter((j) => REMOTE_HINT.test(j.location?.name ?? ""))
    .map((j) => ({
      id: `greenhouse:${board.slug}:${j.id}`,
      source: board.company,
      title: j.title,
      company: board.company,
      url: j.absolute_url,
      // Multi-location postings come as "Home based - Americas; Home based - EMEA".
      locations: (j.location?.name ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      // Greenhouse double-encodes: the HTML itself arrives entity-escaped.
      description: htmlToText(htmlToText(j.content ?? "")),
      postedAt: new Date(j.first_published ?? j.updated_at),
    }));
}

interface AshbyJob {
  id: string;
  title: string;
  location: string;
  secondaryLocations?: { location: string }[];
  isRemote: boolean | null;
  workplaceType: string | null;
  employmentType: string;
  publishedAt: string;
  jobUrl: string;
  descriptionPlain?: string;
  isListed: boolean;
}

async function fetchAshby(board: AtsBoard): Promise<Job[]> {
  const data = await getJson<{ jobs: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${board.slug}`);
  return data.jobs
    .filter((j) => j.isListed !== false)
    .filter((j) =>
      j.workplaceType ? j.workplaceType.toLowerCase() === "remote" : j.isRemote === true || REMOTE_HINT.test(j.location),
    )
    .map((j) => ({
      id: `ashby:${board.slug}:${j.id}`,
      source: board.company,
      title: j.title,
      company: board.company,
      url: j.jobUrl,
      locations: [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean),
      description: j.descriptionPlain ?? "",
      postedAt: new Date(j.publishedAt),
      employmentType: j.employmentType,
    }));
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  workplaceType: string | null;
  categories: { location?: string; allLocations?: string[]; commitment?: string };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
}

async function fetchLever(board: AtsBoard): Promise<Job[]> {
  const data = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${board.slug}?mode=json`);
  return data
    .filter((j) => (j.workplaceType ? j.workplaceType === "remote" : REMOTE_HINT.test(j.categories.location ?? "")))
    .map((j) => ({
      id: `lever:${board.slug}:${j.id}`,
      source: board.company,
      title: j.text,
      company: board.company,
      url: j.hostedUrl,
      locations: j.categories.allLocations?.length ? j.categories.allLocations : [j.categories.location ?? ""].filter(Boolean),
      description: [
        j.descriptionPlain ?? "",
        ...(j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`),
        j.additionalPlain ?? "",
      ].join("\n"),
      postedAt: new Date(j.createdAt),
      employmentType: j.categories.commitment,
    }));
}

const fetchers = { greenhouse: fetchGreenhouse, ashby: fetchAshby, lever: fetchLever };

/** Large boards send several MB each; fetching them all at once makes them time out. */
const CONCURRENCY = 6;

/** Company career pages. A failing board is skipped so one bad slug doesn't sink the rest. */
export async function fetchCompanyBoards(): Promise<Job[]> {
  const results: PromiseSettledResult<Job[]>[] = [];
  for (let i = 0; i < atsBoards.length; i += CONCURRENCY) {
    results.push(...(await Promise.allSettled(atsBoards.slice(i, i + CONCURRENCY).map((b) => fetchers[b.provider](b)))));
  }
  const failures = results.flatMap((r, i) => (r.status === "rejected" ? [atsBoards[i]?.company] : []));
  if (failures.length === atsBoards.length) throw new Error("all company boards failed");
  if (failures.length) console.warn(`company boards failed: ${failures.join(", ")}`);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
