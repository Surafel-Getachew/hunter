"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ELIGIBILITY_LABEL } from "@/lib/jobs/format";
import type { Eligibility } from "@/lib/jobs/types";

const TIER_CLASS: Record<Eligibility, string> = {
  open: "border-tier-open/40 text-tier-open",
  likely: "border-tier-likely/40 text-tier-likely",
  unknown: "border-tier-unknown/40 text-tier-unknown",
  possible: "border-tier-possible/40 text-tier-possible",
  restricted: "border-destructive/40 text-destructive",
};

/** Who the job is open to, with the reason on hover. */
export function TierBadge({ eligibility, reason }: { eligibility: Eligibility; reason: string }) {
  const { badge, label } = ELIGIBILITY_LABEL[eligibility];
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="outline" className={TIER_CLASS[eligibility]} />}>
        <span aria-hidden>{badge}</span>
        {label}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
