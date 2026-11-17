import type { Eligibility } from "./types.ts";

export const ELIGIBILITY_LABEL: Record<Eligibility, { badge: string; label: string }> = {
  open: { badge: "✅", label: "Worldwide / Africa" },
  likely: { badge: "🟡", label: "EMEA or nearby time zone" },
  unknown: { badge: "❔", label: "Just “Remote”" },
  possible: { badge: "🔵", label: "US/Europe-listed, no citizenship requirement" },
  restricted: { badge: "⛔", label: "Restricted" },
};

export function formatAge(at: Date | string | null | undefined, now: Date): string | null {
  if (!at) return null;
  const hours = Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
