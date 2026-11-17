"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { visitSource } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { formatAge } from "@/lib/jobs/format";
import { isDue, MANUAL_SOURCE_GROUPS, type ManualSource } from "@/lib/jobs/manual-sources";

/** Sites the app can't fetch. Opening one records the visit, so it shows as done until it's due again. */
export function ManualSourcesPanel({ visits, now }: { visits: Record<string, string>; now: Date }) {
  const [optimisticVisits, recordVisit] = useOptimistic(visits, (state, id: string) => ({ ...state, [id]: new Date().toISOString() }));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function opened(source: ManualSource) {
    startTransition(async () => {
      recordVisit(source.id);
      const result = await visitSource(source.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {MANUAL_SOURCE_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold">{group.title}</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {group.sources.map((source) => {
              const last = optimisticVisits[source.id];
              const due = isDue(source.cadence, last, now);
              return (
                <li key={source.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => opened(source)}
                      onAuxClick={(e) => e.button === 1 && opened(source)}
                      className="inline-flex items-center gap-1.5 font-medium hover:underline"
                    >
                      {source.name}
                      <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                    </a>
                    <p className="text-sm text-muted-foreground">{source.note}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{source.cadence === "daily" ? "Daily" : "Weekly"}</span>
                    {due ? (
                      <Badge variant="outline" className="border-tier-likely/40 text-tier-likely">
                        Due
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-tier-open/40 text-tier-open">
                        Visited {formatAge(last, now)}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
