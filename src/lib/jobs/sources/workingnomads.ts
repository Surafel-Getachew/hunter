import { getJson } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Job } from "../types.ts";

interface WorkingNomadsJob {
  url: string;
  title: string;
  description: string;
  company_name: string;
  category_name: string;
  tags: string;
  location: string;
  pub_date: string;
}

/** Working Nomads' public feed of its newest remote jobs. Only the Development category is relevant. */
export async function fetchWorkingNomads(): Promise<Job[]> {
  const data = await getJson<WorkingNomadsJob[]>("https://www.workingnomads.com/api/exposed_jobs/");
  return data
    .filter((j) => j.category_name === "Development")
    .map((j) => ({
      id: `workingnomads:${j.url}`,
      source: "Working Nomads",
      title: j.title,
      company: j.company_name,
      url: j.url,
      // "Time zone: CET (+/- 3 hours)" and similar read naturally as locations.
      locations: j.location ? [j.location.replace(/^time zone:\s*/i, "")] : [],
      description: htmlToText(`${j.description}\n${j.tags}`),
      postedAt: j.pub_date ? new Date(j.pub_date) : null,
    }));
}
