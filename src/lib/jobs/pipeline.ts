import { evaluate } from "./filters/score.ts";
import { fetchArc } from "./sources/arc.ts";
import { fetchFourDayWeek } from "./sources/fourdayweek.ts";
import { fetchCompanyBoards } from "./sources/ats.ts";
import { fetchHackerNews } from "./sources/hackernews.ts";
import { fetchHimalayas } from "./sources/himalayas.ts";
import { fetchJobgether } from "./sources/jobgether.ts";
import { fetchJobicy } from "./sources/jobicy.ts";
import { fetchRemoteFirstJobs } from "./sources/remotefirstjobs.ts";
import { fetchRemoteOk } from "./sources/remoteok.ts";
import { fetchRemotive } from "./sources/remotive.ts";
import { fetchWorkable } from "./sources/workable.ts";
import { fetchWorkingNomads } from "./sources/workingnomads.ts";
import { fetchWwr } from "./sources/wwr.ts";
import { dedupeKey } from "./text.ts";
import type { Job, ScoredJob, Source } from "./types.ts";

export const sources: Source[] = [
  { name: "Himalayas", fetch: fetchHimalayas },
  { name: "Arc", fetch: fetchArc },
  { name: "Jobgether", fetch: fetchJobgether },
  { name: "Workable", fetch: fetchWorkable },
  { name: "Remote First Jobs", fetch: fetchRemoteFirstJobs },
  { name: "4dayweek", fetch: fetchFourDayWeek },
  { name: "We Work Remotely", fetch: fetchWwr },
  { name: "Working Nomads", fetch: fetchWorkingNomads },
  { name: "Remotive", fetch: fetchRemotive },
  { name: "RemoteOK", fetch: fetchRemoteOk },
  { name: "Jobicy", fetch: fetchJobicy },
  { name: "HN Who is hiring", fetch: fetchHackerNews },
  { name: "Company boards", fetch: fetchCompanyBoards },
];

export interface SourceStats {
  source: string;
  ok: boolean;
  error: string | null;
  fetched: number;
  matched: number;
  /** Postings dropped per filter stage. */
  rejected: Record<string, number>;
}

/** One board's copy of a posting. */
export interface Sighting {
  source: string;
  sourceJobId: string;
  url: string;
}

export interface MatchedJob {
  /** The best-scoring copy, with `source` set to the board it came from. */
  job: ScoredJob;
  sightings: Sighting[];
}

export interface PipelineResult {
  /** Every match, keyed by dedupe key. */
  jobs: Map<string, MatchedJob>;
  sources: SourceStats[];
  fetched: number;
  /**
   * The earliest posting date any board gave, for every fetched posting,
   * including those filtered out. Ingest uses it to correct stored dates that a
   * board bumped on a re-index.
   */
  postedDates: Map<string, Date>;
}

export interface PipelineOptions {
  now?: Date;
  maxAgeHours?: number;
  /** Called for progress lines and, with `verbose`, for every rejected posting. */
  log?: (line: string) => void;
  verbose?: boolean;
}

/** Fetches every source, filters and scores the postings. Sources fail independently. */
export async function runPipeline({
  now = new Date(),
  maxAgeHours,
  log = () => {},
  verbose = false,
}: PipelineOptions = {}): Promise<PipelineResult> {
  const results = await Promise.allSettled(sources.map((s) => s.fetch()));
  const stats: SourceStats[] = [];
  const jobs = new Map<string, MatchedJob>();
  const postedDates = new Map<string, Date>();
  let fetched = 0;

  results.forEach((result, i) => {
    const name = sources[i]!.name;
    if (result.status === "rejected") {
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log(`${name} failed: ${error}`);
      stats.push({ source: name, ok: false, error, fetched: 0, matched: 0, rejected: {} });
      return;
    }
    const postings: Job[] = result.value;
    fetched += postings.length;
    log(`${name}: ${postings.length} postings`);
    const stat: SourceStats = { source: name, ok: true, error: null, fetched: postings.length, matched: 0, rejected: {} };
    stats.push(stat);

    for (const posting of postings) {
      const key = dedupeKey(posting.company, posting.title);
      const known = postedDates.get(key);
      if (posting.postedAt && (!known || posting.postedAt < known)) postedDates.set(key, posting.postedAt);

      const verdict = evaluate(posting, { now, maxAgeHours });
      if (!verdict.keep) {
        stat.rejected[verdict.stage] = (stat.rejected[verdict.stage] ?? 0) + 1;
        if (verbose) log(`  ✗ [${verdict.stage}] ${posting.title} @ ${posting.company}: ${verdict.reason}`);
        continue;
      }
      stat.matched++;
      const scored: ScoredJob = { ...verdict.job, source: name };
      const sighting: Sighting = { source: name, sourceJobId: posting.id, url: posting.url };
      const existing = jobs.get(key);
      if (!existing) {
        jobs.set(key, { job: scored, sightings: [sighting] });
        continue;
      }
      // The same posting on several boards: keep the strongest copy, remember every board.
      if (!existing.sightings.some((s) => s.source === name)) existing.sightings.push(sighting);
      if (scored.score > existing.job.score) existing.job = scored;
    }
  });

  if (stats.every((s) => !s.ok)) throw new Error("Every job source failed. Check the internet connection.");
  return { jobs, sources: stats, fetched, postedDates };
}
