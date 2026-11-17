import { FetchButton } from "@/components/fetch-button";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobList } from "@/components/jobs/job-list";
import { LogApplicationDialog } from "@/components/jobs/log-application-dialog";
import { db } from "@/db";
import { formatAge } from "@/lib/jobs/format";
import { jobViewCounts, lastFetchRun, listJobSources, listJobs } from "@/lib/jobs/queries";
import { listResumeVersions } from "@/lib/jobs/tracking";
import { parseFilters } from "@/lib/jobs/view";

// "Fetch now" runs here and takes about a minute.
export const maxDuration = 300;

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const now = new Date();
  const [jobs, counts, sources, resumes, run] = await Promise.all([
    listJobs(db, filters, now),
    jobViewCounts(db, now),
    listJobSources(db),
    listResumeVersions(db),
    lastFetchRun(db),
  ]);
  const failed = run?.sources.filter((s) => !s.ok).map((s) => s.source) ?? [];
  const resumeOptions = resumes.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault }));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {run
              ? `Last fetched ${formatAge(run.startedAt, now)} · ${run.fetched.toLocaleString("en-US")} postings checked · ${run.added} new`
              : "Not fetched yet."}
            {failed.length ? <span className="text-destructive"> · failed: {failed.join(", ")}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <LogApplicationDialog resumes={resumeOptions} />
          <FetchButton />
        </div>
      </header>
      <JobFilters filters={filters} sources={sources} counts={counts} />
      <p className="text-sm text-muted-foreground">
        {jobs.length === 300 ? "Showing the first 300" : `Showing ${jobs.length}`}
        {filters.view === "new" ? " · untouched jobs from the last 7 days" : null}
      </p>
      <JobList jobs={jobs} view={filters.view} now={now} resumes={resumeOptions} />
    </>
  );
}
