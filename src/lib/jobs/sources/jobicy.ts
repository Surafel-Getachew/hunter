import { jobicyGeos } from "../config.ts";
import { getJson } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobType: string[];
  jobGeo: string;
  jobDescription: string;
  pubDate: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
}

export async function fetchJobicy(): Promise<Job[]> {
  const jobs = new Map<number, Job>();
  for (const geo of jobicyGeos) {
    const params = new URLSearchParams({ count: "100", geo, industry: "engineering" });
    const data = await getJson<{ jobs?: JobicyJob[] }>(`https://jobicy.com/api/v2/remote-jobs?${params}`);
    for (const j of data.jobs ?? []) {
      const period = j.salaryPeriod === "hourly" ? "hourly" : j.salaryPeriod === "monthly" ? "monthly" : "annual";
      jobs.set(j.id, {
        id: `jobicy:${j.id}`,
        source: "Jobicy",
        title: htmlToText(j.jobTitle),
        company: htmlToText(j.companyName),
        url: j.url,
        locations: j.jobGeo ? [j.jobGeo] : [],
        description: htmlToText(j.jobDescription ?? ""),
        postedAt: j.pubDate ? new Date(j.pubDate) : null,
        employmentType: j.jobType?.join(", "),
        salary:
          j.salaryMin || j.salaryMax
            ? { min: j.salaryMin ?? null, max: j.salaryMax ?? null, period, currency: j.salaryCurrency ?? "USD" }
            : undefined,
      });
    }
  }
  return [...jobs.values()];
}
