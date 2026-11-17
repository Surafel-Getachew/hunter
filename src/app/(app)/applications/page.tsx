import { ApplicationCard } from "@/components/applications/application-card";
import { StatusTabs } from "@/components/applications/status-tabs";
import { LogApplicationDialog } from "@/components/jobs/log-application-dialog";
import { db } from "@/db";
import { APPLICATION_STATUSES, STATUS_LABEL, type ApplicationStatus } from "@/lib/jobs/model";
import { applicationStatusCounts, listApplications } from "@/lib/jobs/queries";
import { listResumeVersions } from "@/lib/jobs/tracking";

type Filter = ApplicationStatus | "all" | "active";

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: Filter =
    status === "all" || (APPLICATION_STATUSES as readonly string[]).includes(status ?? "") ? (status as Filter) : "active";
  const [apps, counts, resumes] = await Promise.all([listApplications(db, filter), applicationStatusCounts(db), listResumeVersions(db)]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const active = (counts.applied ?? 0) + (counts.screening ?? 0) + (counts.interviewing ?? 0) + (counts.offer ?? 0);
  const tabs = [
    { value: "active", label: `In progress · ${active}` },
    ...APPLICATION_STATUSES.filter((s) => counts[s]).map((s) => ({ value: s, label: `${STATUS_LABEL[s]} · ${counts[s]}` })),
    { value: "all", label: `All · ${total}` },
  ];

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold">Applications</h1>
          <p className="text-sm text-muted-foreground">
            Log every reply, call and rejection as it happens: the dashboard works out where things stall from these.
          </p>
        </div>
        <LogApplicationDialog resumes={resumes.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault }))} />
      </header>
      <StatusTabs value={filter} tabs={tabs} />
      {apps.length ? (
        <ol className="flex flex-col gap-3">
          {apps.map((app) => (
            <li key={app.id}>
              <ApplicationCard app={app} now={new Date()} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {total ? "No applications with this status." : "No applications yet. Mark jobs as applied on the Jobs page."}
        </p>
      )}
    </>
  );
}
