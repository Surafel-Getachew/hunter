"use client";

import { useOptimistic, useState, useTransition } from "react";
import { saveJob, unhideJob } from "@/app/actions";
import type { ResumeOption } from "@/components/jobs/apply-fields";
import { JobCard } from "@/components/jobs/job-card";
import type { JobRow } from "@/lib/jobs/queries";
import type { JobView } from "@/lib/jobs/view";

const EMPTY: Record<JobView, string> = {
  new: "Nothing new matches these filters. Press Fetch now, or check the other tabs.",
  saved: "No saved jobs.",
  hidden: "No hidden jobs.",
  all: "No jobs match these filters.",
};

export function JobList({ jobs, view, now, resumes }: { jobs: JobRow[]; view: JobView; now: Date; resumes: ResumeOption[] }) {
  // Cards leave the list as soon as you act; the server refresh confirms it.
  const [removed, remove] = useOptimistic<ReadonlySet<string>, string>(new Set(), (set, id) => new Set([...set, id]));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const leavesView = view !== "all";

  function perform(jobId: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      if (leavesView) remove(jobId);
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  const visible = jobs.filter((j) => !removed.has(j.id));

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {visible.length ? (
        <ol className="flex flex-col gap-3">
          {visible.map((job) => (
            <li key={job.id}>
              <JobCard
                job={job}
                now={now}
                resumes={resumes}
                onChanged={(id) => leavesView && startTransition(() => remove(id))}
                onSave={(id, saved) => perform(id, () => saveJob(id, saved))}
                onRestore={(id) => perform(id, () => unhideJob(id))}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{EMPTY[view]}</p>
      )}
    </div>
  );
}
