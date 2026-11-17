import { ResumeVersions } from "@/components/resume-versions";
import { db } from "@/db";
import { listResumeVersions } from "@/lib/jobs/tracking";

export default async function SettingsPage() {
  const resumes = await listResumeVersions(db);
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Add a CV version each time you change your CV in a meaningful way. Applications record which one you sent, so the dashboard
          can compare their reply rates.
        </p>
      </header>
      <ResumeVersions resumes={resumes.map((r) => ({ id: r.id, name: r.name, url: r.url, notes: r.notes, isDefault: r.isDefault, createdAt: r.createdAt }))} />
    </>
  );
}
