import { SiteNav } from "@/components/site-nav";
import { db } from "@/db";
import { verifySession } from "@/lib/dal";
import { isDue, MANUAL_SOURCES } from "@/lib/jobs/manual-sources";
import { lastVisits } from "@/lib/jobs/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await verifySession();
  const visits = await lastVisits(db);
  const now = new Date();
  const due = MANUAL_SOURCES.filter((s) => isDue(s.cadence, visits[s.id], now)).length;
  return (
    <>
      <SiteNav dueCount={due} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8">{children}</main>
    </>
  );
}
