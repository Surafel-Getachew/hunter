"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { fetchNow } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Fetches every source now. Takes about a minute. */
export function FetchButton() {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function run() {
    setNotice(null);
    startTransition(async () => {
      const result = await fetchNow();
      if (!result.ok) {
        setNotice({ kind: "error", text: result.error });
        return;
      }
      const { added, matched, fetched, failedSources } = result.data;
      const failed = failedSources.length ? ` ${failedSources.join(", ")} failed this time.` : "";
      setNotice({
        kind: "ok",
        text: `${added} new job${added === 1 ? "" : "s"} · ${matched} matches from ${fetched.toLocaleString("en-US")} postings.${failed}`,
      });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={run} disabled={pending} size="lg">
        <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
        {pending ? "Fetching… about a minute" : "Fetch now"}
      </Button>
      {notice ? (
        <p role="status" className={`text-xs ${notice.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
