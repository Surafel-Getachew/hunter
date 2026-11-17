"use client";

import { BookmarkIcon, BookmarkXIcon, ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { ApplyDialog } from "@/components/jobs/apply-dialog";
import { HideDialog } from "@/components/jobs/hide-dialog";
import type { ResumeOption } from "@/components/jobs/apply-fields";
import { TierBadge } from "@/components/tier-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatSalary } from "@/lib/jobs/filters/salary";
import { formatAge } from "@/lib/jobs/format";
import { COMPANY_KIND_LABEL, SKIP_REASON_LABEL, STATUS_LABEL } from "@/lib/jobs/model";
import type { JobRow } from "@/lib/jobs/queries";
import type { SalaryPeriod } from "@/lib/jobs/types";

const SOURCE_LABEL: Record<string, string> = { "Company boards": "company careers page" };

export function JobCard({
  job,
  now,
  resumes,
  onChanged,
  onSave,
  onRestore,
}: {
  job: JobRow;
  now: Date;
  resumes: ResumeOption[];
  /** Applied or hidden: the card leaves the current list. */
  onChanged: (jobId: string) => void;
  onSave: (jobId: string, saved: boolean) => void;
  onRestore: (jobId: string) => void;
}) {
  const salary =
    job.salaryMin != null || job.salaryMax != null
      ? formatSalary({
          min: job.salaryMin,
          max: job.salaryMax,
          period: (job.salaryPeriod ?? "annual") as SalaryPeriod,
          currency: job.salaryCurrency ?? "USD",
        })
      : null;
  const facts = [
    job.company,
    job.companyKind !== "unknown" && job.companyKind !== "employer" ? COMPANY_KIND_LABEL[job.companyKind] : null,
    job.employmentType,
    salary,
    // Some boards (Himalayas) give no trustworthy posting date.
    job.postedAt ? `posted ${formatAge(job.postedAt, now)}` : `found ${formatAge(job.firstSeenAt, now)}`,
    `via ${SOURCE_LABEL[job.source] ?? job.source}`,
  ].filter(Boolean);
  // Arc only gives skills, which already show as chips.
  const snippet = job.snippet.startsWith("Skills:") ? "" : job.snippet;
  const applied = job.applicationStatus != null;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge eligibility={job.eligibility} reason={job.eligibilityReason} />
          {job.category === "ai-training" ? <Badge variant="secondary">AI-training</Badge> : null}
          {applied ? <Badge>{STATUS_LABEL[job.applicationStatus!]}</Badge> : null}
          {job.savedAt && !applied ? <Badge variant="secondary">Saved</Badge> : null}
          {job.hiddenAt && job.skipReason ? <Badge variant="outline">Hidden: {SKIP_REASON_LABEL[job.skipReason]}</Badge> : null}
        </div>
        <h3 className="font-heading text-lg leading-snug font-semibold">
          <a href={job.url} target="_blank" rel="noreferrer" className="hover:underline">
            {job.title}
          </a>
        </h3>
        <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
        {job.matchedSkills.length ? (
          <ul className="flex flex-wrap gap-1" aria-label="Matching skills">
            {job.matchedSkills.map((skill) => (
              <li key={skill} className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
        {snippet ? <p className="line-clamp-2 text-sm text-muted-foreground">{snippet}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
        <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
          <ExternalLinkIcon />
          Open posting
        </a>
        {!applied ? (
          <>
            <ApplyDialog jobId={job.id} title={`${job.title} · ${job.company}`} resumes={resumes} onApplied={() => onChanged(job.id)} />
            {job.hiddenAt ? (
              <Button variant="secondary" onClick={() => onRestore(job.id)}>
                <RotateCcwIcon />
                Restore
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => onSave(job.id, !job.savedAt)}>
                  {job.savedAt ? <BookmarkXIcon /> : <BookmarkIcon />}
                  {job.savedAt ? "Unsave" : "Save"}
                </Button>
                <HideDialog jobId={job.id} title={`${job.title} · ${job.company}`} onHidden={() => onChanged(job.id)} />
              </>
            )}
          </>
        ) : null}
      </div>
    </article>
  );
}
