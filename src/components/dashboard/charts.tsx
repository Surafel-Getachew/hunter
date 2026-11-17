import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BreakdownRow } from "@/lib/jobs/funnel";

export const pct = (rate: number | null) => (rate == null ? "–" : `${Math.round(rate * 100)}%`);

/** Horizontal bars for one series, value at the tip. Hover shows the exact figure. */
export function BarList({ rows, max, unit }: { rows: { key: string; value: number; detail: string }[]; max: number; unit?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const width = max > 0 ? Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0) : 0;
        return (
          <li key={row.key} className="grid grid-cols-[minmax(8rem,14rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground" title={row.key}>
              {row.key}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={<div className="flex h-6 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} />}
              >
                <span className="h-4 rounded-r-[4px] bg-chart-1" style={{ width: `${width}%` }} />
                <span className="shrink-0 tabular-nums">
                  {row.value.toLocaleString("en-US")}
                  {unit}
                </span>
              </TooltipTrigger>
              <TooltipContent>{row.detail}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** Applications, positive replies and reply rate per group, with the rate drawn as a bar. */
export function BreakdownTable({ title, rows, caption }: { title: string; rows: BreakdownRow[]; caption?: string }) {
  const maxRate = Math.max(0, ...rows.map((r) => r.positiveRate ?? 0));
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chart-grid text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-normal">Group</th>
              <th className="py-1.5 text-right font-normal">Applied</th>
              <th className="py-1.5 text-right font-normal">Positive replies</th>
              <th className="w-2/5 py-1.5 pl-3 font-normal">Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-chart-grid last:border-0">
                <td className="max-w-48 truncate py-1.5" title={r.key}>
                  {r.key}
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.applications}</td>
                <td className="py-1.5 text-right tabular-nums">{r.positive}</td>
                <td className="py-1.5 pl-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 rounded-r-[4px] bg-chart-1"
                      style={{ width: `${maxRate > 0 ? ((r.positiveRate ?? 0) / maxRate) * 70 : 0}%` }}
                    />
                    <span className="tabular-nums text-muted-foreground">
                      {pct(r.positiveRate)}
                      {r.applications < 10 ? " · few" : ""}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No applications yet.</p>
      )}
    </section>
  );
}

const SERIES = [
  { key: "matches", label: "New matches found", className: "bg-chart-1" },
  { key: "applications", label: "Applications sent", className: "bg-chart-2" },
] as const;

/** Matches found vs applications sent per week: the volume gap at a glance. */
export function WeeklyChart({ weeks }: { weeks: { week: string; matches: number; applications: number }[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.matches, w.applications]));
  const height = 160;
  const label = (week: string) => new Date(`${week}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const last = weeks.at(-1);

  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-lg font-semibold">Weekly volume</span>
        <span className="flex gap-4 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[2px] ${s.className}`} aria-hidden />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="relative" style={{ height: height + 24 }}>
        <div className="absolute inset-x-0 border-t border-chart-grid" style={{ top: 0 }} aria-hidden />
        <div className="absolute inset-x-0 border-t border-chart-grid" style={{ top: height / 2 }} aria-hidden />
        <span className="absolute -top-2 right-0 text-[10px] text-muted-foreground tabular-nums">{max}</span>
        <div className="absolute inset-x-0 top-0 flex items-end justify-between gap-2" style={{ height }} aria-hidden>
          {weeks.map((w) => (
            <Tooltip key={w.week}>
              <TooltipTrigger render={<div className="flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm hover:bg-muted/60" />}>
                {SERIES.map((s) => (
                  <span
                    key={s.key}
                    className={`w-full max-w-6 rounded-t-[4px] ${s.className}`}
                    style={{ height: `${(w[s.key] / max) * 100}%`, minHeight: w[s.key] ? 2 : 0 }}
                  />
                ))}
              </TooltipTrigger>
              <TooltipContent>
                Week of {label(w.week)}: {w.matches} new matches, {w.applications} applications
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2 border-t border-border pt-1" aria-hidden>
          {weeks.map((w) => (
            <span key={w.week} className="flex-1 text-center text-[11px] text-muted-foreground">
              {label(w.week)}
            </span>
          ))}
        </div>
      </div>
      {last ? (
        <p className="text-sm text-muted-foreground">
          This week so far: {last.matches} new matches, {last.applications} applications.
        </p>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="font-normal">Week of</th>
              <th className="text-right font-normal">New matches</th>
              <th className="text-right font-normal">Applications</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td>{label(w.week)}</td>
                <td className="text-right tabular-nums">{w.matches}</td>
                <td className="text-right tabular-nums">{w.applications}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
