// Sites that can't be fetched automatically (login walls, bot blocking), so the
// app lists them to visit by hand and reminds you when one is due. Client-safe.

export type Cadence = "daily" | "weekly";

export interface ManualSource {
  id: string;
  name: string;
  url: string;
  note: string;
  cadence: Cadence;
}

export interface ManualSourceGroup {
  title: string;
  sources: ManualSource[];
}

/**
 * Google search limited to pages it found in the past 24 hours. Google reads
 * only the first 32 words of a query, so keep queries under that (tested).
 */
const google = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:d`;

/** Your stack, fully remote, and no US-only, clearance, hybrid or on-site roles. */
const ROLE = '("full stack" OR fullstack) (react OR "next.js" OR node)';
const FULLY_REMOTE = '("fully remote" OR "100% remote" OR "work from anywhere" OR worldwide)';
const EXCLUDE = '-"US only" -clearance -hybrid -onsite';

export const MANUAL_SOURCE_GROUPS: ManualSourceGroup[] = [
  {
    title: "LinkedIn & X",
    sources: [
      {
        id: "linkedin-emea",
        name: "LinkedIn jobs: EMEA",
        url: "https://www.linkedin.com/jobs/search/?keywords=full%20stack%20developer&geoId=91000007&f_WT=2&f_AL=true&f_TPR=r86400&sortBy=DD",
        note: "Remote, Easy Apply, past 24 hours. Remove Easy Apply now and then: fewer applicants.",
        cadence: "daily",
      },
      {
        id: "linkedin-posts",
        name: "LinkedIn posts: “hiring full stack remote”",
        url: "https://www.linkedin.com/search/results/content/?keywords=%22hiring%22%20%22full%20stack%22%20remote&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
        note: "Reply with one specific line, then message the poster with your Galatea link.",
        cadence: "daily",
      },
      {
        id: "x-posts",
        name: "X: hiring posts",
        url: "https://x.com/search?q=(hiring%20OR%20%22we%27re%20hiring%22)%20(%22full%20stack%22%20OR%20react%20OR%20%22next.js%22)%20remote%20-%22US%20only%22%20-filter%3Areplies&f=live",
        note: "Latest posts. Skip anyone asking you to pay or run their code on your machine.",
        cadence: "daily",
      },
    ],
  },
  {
    title: "Job boards",
    sources: [
      {
        id: "wellfound",
        name: "Wellfound",
        url: "https://wellfound.com/jobs",
        note: "Startups. Set the remote filter to accept worldwide, and turn on its email alerts.",
        cadence: "weekly",
      },
      {
        id: "remote-africa",
        name: "Remote Africa",
        url: "https://remoteafrica.io/jobs",
        note: "Small board aimed at African professionals.",
        cadence: "weekly",
      },
      {
        id: "dynamite-jobs",
        name: "Dynamite Jobs",
        url: "https://dynamitejobs.com/remote-jobs/remote-software-development-jobs",
        note: "Remote-only board; check each posting's location.",
        cadence: "weekly",
      },
      {
        id: "justremote",
        name: "JustRemote",
        url: "https://justremote.co/remote-developer-jobs",
        note: "Filter to “Work from anywhere”.",
        cadence: "weekly",
      },
    ],
  },
  {
    title: "Google: company job pages",
    sources: [
      {
        id: "google-ashby",
        name: "Ashby job pages",
        url: google(`site:jobs.ashbyhq.com ${ROLE} ${FULLY_REMOTE} ${EXCLUDE}`),
        note: "Startups hiring through Ashby, past 24 hours. Open the posting and check the location line.",
        cadence: "daily",
      },
      {
        id: "google-greenhouse",
        name: "Greenhouse job pages",
        url: google(`(site:job-boards.greenhouse.io OR site:boards.greenhouse.io) ${ROLE} ${FULLY_REMOTE} ${EXCLUDE}`),
        note: "Companies hiring through Greenhouse, past 24 hours.",
        cadence: "daily",
      },
      {
        id: "google-lever",
        name: "Lever job pages",
        url: google(`site:jobs.lever.co ${ROLE} ${FULLY_REMOTE} ${EXCLUDE}`),
        note: "Companies hiring through Lever, past 24 hours.",
        cadence: "daily",
      },
      {
        id: "google-contractor",
        name: "Contractor roles on all three",
        url: google(
          `(site:jobs.ashbyhq.com OR site:job-boards.greenhouse.io OR site:jobs.lever.co) ${ROLE} "fully remote" (contractor OR "independent contractor") ${EXCLUDE}`,
        ),
        note: "Contract roles, past 24 hours: the likeliest to hire abroad, even when listed for the US or Europe.",
        cadence: "daily",
      },
    ],
  },
  {
    title: "Talent networks",
    sources: [
      { id: "arc", name: "Arc", url: "https://arc.dev/remote-jobs", note: "Check your matches and messages.", cadence: "weekly" },
      { id: "andela", name: "Andela", url: "https://www.andela.com/talent", note: "Africa-focused network; check matches.", cadence: "weekly" },
      { id: "micro1", name: "micro1", url: "https://www.micro1.ai/jobs", note: "Apply per role; ~20-minute AI interview. Pays through Deel.", cadence: "weekly" },
      { id: "proxify", name: "Proxify", url: "https://proxify.io/", note: "Its roles ask for CET ± 3 hours, which includes Ethiopia.", cadence: "weekly" },
      { id: "toptal", name: "Toptal", url: "https://www.toptal.com/talent/apply", note: "Apply once your algorithm practice is ready.", cadence: "weekly" },
      { id: "crossover", name: "Crossover", url: "https://www.crossover.com/jobs", note: "Practise the 15-minute aptitude test first.", cadence: "weekly" },
    ],
  },
  {
    title: "AI-training dashboards",
    sources: [
      { id: "mindrift", name: "Mindrift", url: "https://mindrift.ai/", note: "Projects appear in your dashboard after sign-up.", cadence: "weekly" },
      { id: "outlier", name: "Outlier", url: "https://outlier.ai/", note: "Check whether Ethiopia is accepted at sign-up.", cadence: "weekly" },
      { id: "alignerr", name: "Alignerr", url: "https://www.alignerr.com/", note: "Coding expert roles; pays via Deel, PayPal or Stripe.", cadence: "weekly" },
      { id: "turing", name: "Turing", url: "https://www.turing.com/jobs", note: "Developer and AI-training work.", cadence: "weekly" },
    ],
  },
];

export const MANUAL_SOURCES: ManualSource[] = MANUAL_SOURCE_GROUPS.flatMap((g) => g.sources);

const WEEK_MS = 7 * 86_400_000;

/** Daily sites are due once per calendar day; weekly ones a week after the last visit. */
export function isDue(cadence: Cadence, lastVisit: string | undefined, now: Date): boolean {
  if (!lastVisit) return true;
  const visited = new Date(lastVisit);
  if (cadence === "daily") return visited.toDateString() !== now.toDateString();
  return now.getTime() - visited.getTime() >= WEEK_MS;
}
