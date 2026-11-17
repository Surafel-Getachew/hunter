import { getJson } from "../http.ts";
import { htmlToText, truncate } from "../text.ts";
import type { Job } from "../types.ts";

interface AlgoliaHit {
  objectID: string;
  title: string;
  created_at: string;
}

interface HnItem {
  id: number;
  text: string | null;
  created_at: string;
  children: HnItem[];
}

const THREAD_MAX_AGE_DAYS = 40;
/** Header segments that talk about location/remote-ness. */
const LOCATION_SEGMENT =
  /remote|onsite|on-site|hybrid|worldwide|anywhere|global|emea|europe|africa|\b(us|usa|uk|eu|uae)\b|timezone|utc|gmt/i;

/** Monthly "Ask HN: Who is hiring?" thread; one top-level comment per company. */
export async function fetchHackerNews(): Promise<Job[]> {
  const search = await getJson<{ hits: AlgoliaHit[] }>(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5",
  );
  const thread = search.hits.find((h) => h.title.startsWith("Ask HN: Who is hiring?"));
  if (!thread) return [];
  const threadAgeDays = (Date.now() - new Date(thread.created_at).getTime()) / 86_400_000;
  if (threadAgeDays > THREAD_MAX_AGE_DAYS) return [];

  const item = await getJson<HnItem>(`https://hn.algolia.com/api/v1/items/${thread.objectID}`);
  const jobs: Job[] = [];
  for (const comment of item.children) {
    if (!comment.text) continue;
    const text = htmlToText(comment.text);
    const [header = "", ...rest] = text.split("\n");
    if (!/\bremote\b/i.test(header)) continue;

    const segments = header.split(/\s+[|•·—–-]\s+|\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
    const company = (segments[0] ?? "").replace(/\s*\(.*\)\s*$/, "");
    // Locations are often in parentheses after the name: "Acme (Remote US)".
    const inParens = [...header.matchAll(/\(([^)]*)\)/g)].map((m) => m[1] ?? "");
    const locations = [...segments.slice(1), ...inParens].filter((s) => LOCATION_SEGMENT.test(s));

    jobs.push({
      id: `hn:${comment.id}`,
      source: "HN Who is hiring",
      title: truncate(segments.slice(1).join(" · ") || header, 140),
      company,
      url: `https://news.ycombinator.com/item?id=${comment.id}`,
      locations,
      description: rest.join("\n"),
      // Threads are monthly; use the comment's own date so the age filter works.
      postedAt: new Date(comment.created_at),
    });
  }
  return jobs;
}
