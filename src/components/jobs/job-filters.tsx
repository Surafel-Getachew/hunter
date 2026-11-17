"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ELIGIBILITY_LABEL } from "@/lib/jobs/format";
import type { Eligibility } from "@/lib/jobs/types";
import {
  DEFAULT_FILTERS,
  filtersToSearch,
  POSTED_WITHIN,
  VISIBLE_TIERS,
  type JobFilters as Filters,
  type JobView,
  type Section,
  type SortOrder,
} from "@/lib/jobs/view";

const SECTIONS: { value: Section; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "main", label: "Full-stack roles" },
  { value: "ai-training", label: "AI-training contracts" },
];
const SORTS: { value: SortOrder; label: string }[] = [
  { value: "best", label: "Open to anyone first" },
  { value: "newest", label: "Newest" },
];
const WITHIN = POSTED_WITHIN.map((p) => ({ value: p.value, label: p.label }));

/** Filters live in the URL; changing one re-runs the server query. */
export function JobFilters({
  filters,
  sources,
  counts,
}: {
  filters: Filters;
  sources: string[];
  counts: { new: number; saved: number; hidden: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query);

  const go = (next: Filters) => startTransition(() => router.replace(`${pathname}${filtersToSearch(next)}`, { scroll: false }));
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => go({ ...filters, [key]: value });

  // Search waits for a pause in typing.
  useEffect(() => {
    if (query === filters.query) return;
    const t = setTimeout(() => go({ ...filters, query }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should trigger this
  }, [query]);

  const within = POSTED_WITHIN.find((p) => p.hours === filters.postedWithinHours)?.value ?? "any";
  const sourceOptions = [{ value: "all", label: "All sources" }, ...sources.map((s) => ({ value: s, label: s }))];
  const isDefault = filtersToSearch({ ...filters, view: DEFAULT_FILTERS.view }) === "";

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <Tabs value={filters.view} onValueChange={(v) => set("view", v as JobView)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="new">New · {counts.new}</TabsTrigger>
          <TabsTrigger value="saved">Saved · {counts.saved}</TabsTrigger>
          <TabsTrigger value="hidden">Hidden · {counts.hidden}</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, company, description…"
              aria-label="Search jobs"
              className="bg-background pl-8"
            />
          </div>
          <OptionSelect label="Role type" value={filters.section} options={SECTIONS} onChange={(v) => set("section", v)} />
          <OptionSelect
            label="Posted within"
            value={within}
            options={WITHIN}
            onChange={(v) => set("postedWithinHours", POSTED_WITHIN.find((p) => p.value === v)?.hours ?? null)}
          />
          <OptionSelect label="Source" value={filters.source} options={sourceOptions} onChange={(v) => set("source", v)} />
          <OptionSelect label="Sort" value={filters.sort} options={SORTS} onChange={(v) => set("sort", v)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Open to:</span>
          <ToggleGroup
            multiple
            variant="outline"
            size="sm"
            value={filters.tiers}
            onValueChange={(value) => set("tiers", value as Eligibility[])}
            aria-label="Eligibility"
            className="flex-wrap"
          >
            {VISIBLE_TIERS.map((tier) => (
              <ToggleGroupItem key={tier} value={tier} className="data-pressed:bg-accent">
                <span aria-hidden>{ELIGIBILITY_LABEL[tier].badge}</span>
                {ELIGIBILITY_LABEL[tier].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {!isDefault ? (
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setQuery("");
                go({ ...DEFAULT_FILTERS, view: filters.view });
              }}
            >
              Reset filters
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
