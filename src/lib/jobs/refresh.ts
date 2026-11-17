import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../../db/index.ts";
import { fetchRuns } from "../../db/schema.ts";
import { ingest } from "./ingest.ts";
import { runPipeline, type PipelineOptions } from "./pipeline.ts";

export type FetchTrigger = "manual" | "cron" | "cli";

export interface FetchSummary {
  runId: string;
  at: string;
  fetched: number;
  matched: number;
  added: number;
  failedSources: string[];
  durationMs: number;
}

/** A run that hasn't finished after this long is assumed to have crashed. */
const STALE_RUN_MS = 10 * 60_000;

export class FetchInProgressError extends Error {
  constructor() {
    super("A fetch is already running. It takes about a minute.");
  }
}

/** Fetches every source and stores the matches. One run at a time, recorded in fetch_runs. */
export async function refreshJobs(
  db: Database,
  { trigger, ...options }: Omit<PipelineOptions, "now"> & { trigger: FetchTrigger },
): Promise<FetchSummary> {
  const now = new Date();
  const running = await db
    .select({ id: fetchRuns.id })
    .from(fetchRuns)
    .where(and(isNull(fetchRuns.finishedAt), gt(fetchRuns.startedAt, new Date(now.getTime() - STALE_RUN_MS))))
    .limit(1);
  if (running.length) throw new FetchInProgressError();

  const [run] = await db
    .insert(fetchRuns)
    .values({ trigger, startedAt: now, maxAgeHours: options.maxAgeHours ?? null })
    .returning({ id: fetchRuns.id });
  const runId = run!.id;

  try {
    const result = await runPipeline({ ...options, now });
    const added = await ingest(db, result, runId, now);
    const durationMs = Date.now() - now.getTime();
    const summary: FetchSummary = {
      runId,
      at: now.toISOString(),
      fetched: result.fetched,
      matched: result.jobs.size,
      added,
      failedSources: result.sources.filter((s) => !s.ok).map((s) => s.source),
      durationMs,
    };
    await db
      .update(fetchRuns)
      .set({ finishedAt: new Date(), durationMs, fetched: summary.fetched, matched: summary.matched, added })
      .where(eq(fetchRuns.id, runId));
    return summary;
  } catch (err) {
    await db
      .update(fetchRuns)
      .set({ finishedAt: new Date(), durationMs: Date.now() - now.getTime(), error: err instanceof Error ? err.message : String(err) })
      .where(eq(fetchRuns.id, runId));
    throw err;
  }
}
