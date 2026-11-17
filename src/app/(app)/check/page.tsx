import { ManualSourcesPanel } from "@/components/manual-sources-panel";
import { db } from "@/db";
import { lastVisits } from "@/lib/jobs/queries";

export default async function CheckPage() {
  const visits = await lastVisits(db);
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold">Check by hand</h1>
        <p className="text-sm text-muted-foreground">
          These sites block automated fetching or need your login. Opening a link marks it visited; daily sites come back the next
          day, weekly ones after a week. Log anything you apply to from here with “Log an application” on the Jobs page.
        </p>
      </header>
      <ManualSourcesPanel visits={visits} now={new Date()} />
    </>
  );
}
