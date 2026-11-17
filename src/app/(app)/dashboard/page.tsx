import { BarList, BreakdownTable, pct, WeeklyChart } from "@/components/dashboard/charts";
import { db } from "@/db";
import { formatAge } from "@/lib/jobs/format";
import { NO_REPLY_AFTER_DAYS, type BottleneckStage } from "@/lib/jobs/funnel";
import { dashboardData } from "@/lib/jobs/queries";

const STAGE_LABEL: Record<BottleneckStage, string> = {
  volume: "Stage 1 of 4 · Volume",
  response: "Stage 2 of 4 · Replies",
  screens: "Stage 3 of 4 · Screens",
  interviews: "Stage 4 of 4 · Interviews",
  on_track: "No bottleneck yet",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const d = await dashboardData(db, now);
  const t = d.totals;
  const applyRate = d.matchesLast7Days ? d.applicationsLast7Days / d.matchesLast7Days : null;
  const funnel = [
    { key: "Applied", value: t.applications },
    { key: "Got any answer", value: t.responded },
    { key: "Positive reply", value: t.positive },
    { key: "Technical interview", value: t.interviewed },
    { key: "Offer", value: t.offered },
  ].map((s) => ({ ...s, detail: `${s.value} of ${t.applications} applications (${pct(t.applications ? s.value / t.applications : null)})` }));

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Where the search stalls, checked in funnel order: volume first, then replies, screens and interviews.
        </p>
      </header>

      <section className="flex flex-col gap-1 rounded-xl border-l-4 border-primary bg-card p-5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{STAGE_LABEL[d.verdict.stage]}</span>
        <h2 className="font-heading text-2xl font-semibold">{d.verdict.headline}</h2>
        <p className="text-sm">{d.verdict.detail}</p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="New matches, last 7 days" value={String(d.matchesLast7Days)} />
        <Stat label="Applied, last 7 days" value={String(d.applicationsLast7Days)} note={applyRate == null ? undefined : `${pct(applyRate)} of new matches`} />
        <Stat label="Positive reply rate" value={pct(t.responseRate)} note={`${t.positive} of ${t.applications}`} />
        <Stat label="Interviews" value={String(t.interviewed)} />
        <Stat label="Offers" value={String(t.offered)} />
        <Stat
          label="Median days to an answer"
          value={t.medianDaysToFirstResponse == null ? "–" : String(Math.round(t.medianDaysToFirstResponse))}
          note={`${t.awaiting} waiting · ${t.noReply} no reply after ${NO_REPLY_AFTER_DAYS} days`}
        />
      </div>

      <WeeklyChart weeks={d.weekly} />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h3 className="font-heading text-lg font-semibold">Funnel</h3>
        <BarList rows={funnel} max={Math.max(1, t.applications)} />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownTable title="By who it's open to" rows={d.breakdowns.byTier} caption="Are 🔵 US/Europe-listed jobs worth it compared with ✅ worldwide ones?" />
        <BreakdownTable title="By how soon you applied" rows={d.breakdowns.bySpeed} caption="Time between the posting going up and your application." />
        <BreakdownTable title="By how you applied" rows={d.breakdowns.byChannel} />
        <BreakdownTable title="By source" rows={d.breakdowns.bySource} />
        <BreakdownTable title="By CV version" rows={d.breakdowns.byResume} caption="Add versions on the Settings page." />
        <BreakdownTable title="By company type" rows={d.breakdowns.byCompanyKind} caption="Mark agencies on the Applications page." />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h3 className="font-heading text-lg font-semibold">Sources, last 7 days</h3>
          <p className="text-xs text-muted-foreground">
            New jobs each source brought in this week (a job on two boards counts for both), its last fetch, and what came of the
            applications.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chart-grid text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-normal">Source</th>
                <th className="py-1.5 text-right font-normal">New jobs</th>
                <th className="py-1.5 text-right font-normal">Last fetch</th>
                <th className="py-1.5 text-right font-normal">Applied</th>
                <th className="py-1.5 text-right font-normal">Replies</th>
              </tr>
            </thead>
            <tbody>
              {d.sources.map((s) => (
                <tr key={s.source} className="border-b border-chart-grid last:border-0">
                  <td className="py-1.5">
                    {s.source}
                    {s.failures ? <span className="text-destructive"> · failed {s.failures}×</span> : null}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{s.newLast7Days}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {s.lastRunMatched} of {s.lastRunFetched.toLocaleString("en-US")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{s.applications}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.positive}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.sources.length ? <p className="text-sm text-muted-foreground">No fetches yet.</p> : null}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h3 className="font-heading text-lg font-semibold">Why you skip jobs</h3>
          <p className="text-xs text-muted-foreground">A big reason here means a filter is letting the wrong jobs through.</p>
          {d.skipReasons.length ? (
            <BarList
              rows={d.skipReasons.map((r) => ({ key: r.key, value: r.n, detail: `${r.n} jobs hidden: ${r.key}` }))}
              max={Math.max(...d.skipReasons.map((r) => r.n))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing hidden yet.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {d.visitsLast7Days} visits to the “Check by hand” sites in the last 7 days.
          </p>
        </section>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <h3 className="font-heading text-lg font-semibold">Recent fetches</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {d.recentRuns.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="text-foreground">{formatAge(r.startedAt, now)}</span>
              <span>· {r.trigger}</span>
              {r.error ? (
                <span className="text-destructive">· failed: {r.error}</span>
              ) : r.finishedAt ? (
                <span>
                  · {r.added} new, {r.matched} matched of {r.fetched.toLocaleString("en-US")} in {Math.round((r.durationMs ?? 0) / 1000)}s
                </span>
              ) : (
                <span>· running…</span>
              )}
            </li>
          ))}
          {!d.recentRuns.length ? <li className="text-muted-foreground">No fetches yet.</li> : null}
        </ul>
      </section>
    </>
  );
}
