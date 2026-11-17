import { remotiveCategories } from "../config.ts";
import { getJson } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  description: string;
}

/** Remotive's terms require linking back to the Remotive posting, which `url` is. */
export async function fetchRemotive(): Promise<Job[]> {
  const jobs: Job[] = [];
  for (const category of remotiveCategories) {
    const data = await getJson<{ jobs: RemotiveJob[] }>(`https://remotive.com/api/remote-jobs?category=${category}`);
    for (const j of data.jobs) {
      jobs.push({
        id: `remotive:${j.id}`,
        source: "Remotive",
        title: j.title,
        company: j.company_name,
        url: j.url,
        locations: j.candidate_required_location ? [j.candidate_required_location] : [],
        description: htmlToText(j.description),
        // Timestamps come without a zone; Remotive publishes in UTC.
        postedAt: j.publication_date ? new Date(`${j.publication_date.replace(/Z$/, "")}Z`) : null,
        employmentType: j.job_type?.replace(/_/g, " "),
      });
    }
  }
  return jobs;
}
