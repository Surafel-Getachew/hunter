import { XMLParser } from "fast-xml-parser";
import { wwrFeeds } from "../config.ts";
import { getText } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface WwrItem {
  title: string;
  region?: string;
  country?: string;
  type?: string;
  description?: string;
  pubDate?: string;
  link: string;
  guid?: string | { "#text": string };
}

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true, htmlEntities: true });

/** We Work Remotely RSS. Titles are "Company: Role". */
export async function fetchWwr(): Promise<Job[]> {
  const jobs = new Map<string, Job>();
  for (const feed of wwrFeeds) {
    const xml = await getText(`https://weworkremotely.com/categories/${feed}.rss`);
    const parsed = parser.parse(xml) as { rss?: { channel?: { item?: WwrItem | WwrItem[] } } };
    const raw = parsed.rss?.channel?.item ?? [];
    for (const item of Array.isArray(raw) ? raw : [raw]) {
      const title = String(item.title ?? "");
      const sep = title.indexOf(": ");
      jobs.set(item.link, {
        id: `wwr:${item.link}`,
        source: "We Work Remotely",
        title: sep > 0 ? title.slice(sep + 2) : title,
        company: sep > 0 ? title.slice(0, sep) : "",
        url: item.link,
        locations: [item.region, item.country].filter((v): v is string => typeof v === "string" && v.trim() !== ""),
        description: htmlToText(String(item.description ?? "")),
        postedAt: item.pubDate ? new Date(item.pubDate) : null,
        employmentType: item.type,
      });
    }
  }
  return [...jobs.values()];
}
