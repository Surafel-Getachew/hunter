import { getJson } from "../http.ts";
import { fixMojibake, htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface RemoteOkJob {
  id: string;
  epoch: number;
  company: string;
  position: string;
  location: string;
  description: string;
  url: string;
  salary_min: number;
  salary_max: number;
}

/** First element of the response is a legal notice; RemoteOK's terms require linking to `url`. */
export async function fetchRemoteOk(): Promise<Job[]> {
  const data = await getJson<unknown[]>("https://remoteok.com/api");
  return data
    .filter((row): row is RemoteOkJob => typeof row === "object" && row !== null && "position" in row)
    .map((j) => ({
      id: `remoteok:${j.id}`,
      source: "RemoteOK",
      title: fixMojibake(j.position),
      company: fixMojibake(j.company),
      url: j.url,
      locations: j.location ? [fixMojibake(j.location)] : [],
      description: htmlToText(fixMojibake(j.description ?? "")),
      postedAt: j.epoch ? new Date(j.epoch * 1000) : null,
      salary:
        j.salary_min > 0 || j.salary_max > 0
          ? { min: j.salary_min || null, max: j.salary_max || null, period: "annual", currency: "USD" }
          : undefined,
    }));
}
