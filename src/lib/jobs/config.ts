export const profile = {
  country: { code: "ET", name: "Ethiopia" },
  /** $3,000/month floor. Postings that state a lower maximum are dropped. */
  minAnnualUsd: 36_000,
  /**
   * Postings older than this aren't fetched, and a job you haven't saved or
   * tracked leaves the list this many days after it first appeared.
   */
  maxAgeDays: 7,
  /** How long a hidden or expired job is remembered, so a re-fetch doesn't bring it back. */
  forgetAfterDays: 60,
  minScore: 6,
  /** Postings whose location is just "Remote", with no limits stated. */
  includeUnknownEligibility: true,
  /**
   * Remote postings listed only for the US/Canada/UK/Europe that state no
   * residency, citizenship or work-authorisation requirement (🔵).
   */
  includeWesternListed: true,
  /**
   * Separate section for AI-training coding contracts (micro1, Invisible,
   * G2i, xAI tutors…). Part-time bridge income, so the salary floor doesn't apply.
   */
  includeAiTraining: true,
};

/** Skill keywords searched in title + description, with their weight in the score. */
export const skills: { label: string; pattern: RegExp; weight: number; core?: boolean }[] = [
  { label: "react", pattern: /\breact(\.?js)?\b/i, weight: 3, core: true },
  { label: "next.js", pattern: /\bnext\.?js\b/i, weight: 3, core: true },
  { label: "node", pattern: /\bnode(\.?js)?\b/i, weight: 2, core: true },
  { label: "typescript", pattern: /\btypescript\b/i, weight: 2, core: true },
  { label: "javascript", pattern: /\bjavascript\b/i, weight: 1, core: true },
  { label: "langchain", pattern: /\blang(chain|graph)\b/i, weight: 3 },
  { label: "llm", pattern: /\b(llms?|large language models?|genai|generative ai|ai agents?|agentic)\b/i, weight: 2 },
  { label: "supabase", pattern: /\bsupabase\b/i, weight: 2 },
  { label: "postgres", pattern: /\bpostgre(s|sql)\b/i, weight: 1 },
  { label: "tailwind", pattern: /\btailwind\b/i, weight: 1 },
  { label: "express", pattern: /\bexpress(\.?js)?\b/i, weight: 1 },
];

export const himalayasQueries = [
  "full stack",
  "frontend",
  "react",
  "node.js",
  "typescript",
  "next.js",
  // AI-training contracts
  "AI trainer",
  "AI tutor",
  "code reviewer",
];

/** Searches on Workable's job search (every company hiring through Workable). */
export const workableQueries = ["full stack", "react", "next.js", "node.js", "typescript", "frontend"];

/** Category slugs under https://arc.dev/remote-jobs/<slug>; each page shows its newest ~45 jobs. */
export const arcCategories = ["full-stack", "reactjs", "nextjs", "nodejs", "typescript", "javascript", "llm"];

export const remotiveCategories = ["software-dev"];

export const jobicyGeos = ["anywhere", "emea"];

export const wwrFeeds = [
  "remote-full-stack-programming-jobs",
  "remote-front-end-programming-jobs",
  "remote-back-end-programming-jobs",
];

export type AtsBoard = { provider: "greenhouse" | "ashby" | "lever"; slug: string; company: string };

/**
 * Companies with public job boards that hire remotely across many countries.
 * Every posting still goes through the eligibility filter, so a US-only role
 * at one of these companies is dropped. Add more by checking that
 * https://boards-api.greenhouse.io/v1/boards/<slug>/jobs,
 * https://api.ashbyhq.com/posting-api/job-board/<slug> or
 * https://api.lever.co/v0/postings/<slug> returns jobs.
 */
export const atsBoards: AtsBoard[] = [
  { provider: "greenhouse", slug: "canonical", company: "Canonical" },
  { provider: "greenhouse", slug: "gitlab", company: "GitLab" },
  { provider: "greenhouse", slug: "wikimedia", company: "Wikimedia Foundation" },
  { provider: "greenhouse", slug: "vercel", company: "Vercel" },
  { provider: "greenhouse", slug: "mozilla", company: "Mozilla" },
  { provider: "greenhouse", slug: "sourcegraph91", company: "Sourcegraph" },
  { provider: "ashby", slug: "supabase", company: "Supabase" },
  { provider: "ashby", slug: "posthog", company: "PostHog" },
  { provider: "ashby", slug: "oyster", company: "Oyster" },
  { provider: "ashby", slug: "n8n", company: "n8n" },
  { provider: "ashby", slug: "sentry", company: "Sentry" },
  { provider: "ashby", slug: "zapier", company: "Zapier" },
  { provider: "ashby", slug: "kraken.com", company: "Kraken" },
  { provider: "ashby", slug: "replit", company: "Replit" },
  { provider: "ashby", slug: "linear", company: "Linear" },
  // Companies Himalayas lists as hiring from Ethiopia (checked 2026-11-02). Their own
  // boards give real posting dates, which Himalayas doesn't. Company names match
  // Himalayas' so the same posting is recognised on both.
  { provider: "greenhouse", slug: "amplemarket", company: "Amplemarket" },
  { provider: "greenhouse", slug: "consensys", company: "Consensys" },
  { provider: "greenhouse", slug: "sportygroup", company: "Sporty Group" },
  { provider: "greenhouse", slug: "whitetech", company: "WhiteTech" },
  { provider: "greenhouse", slug: "customerio", company: "Customer.io" },
  { provider: "ashby", slug: "clera", company: "Clera" },
  { provider: "greenhouse", slug: "b12", company: "B12" },
  { provider: "lever", slug: "spotify", company: "Spotify" },
  { provider: "ashby", slug: "hercules", company: "Hercules" },
  { provider: "greenhouse", slug: "alpaca", company: "Alpaca" },
  { provider: "greenhouse", slug: "dwelly", company: "Dwelly" },
  { provider: "greenhouse", slug: "nebius", company: "Nebius" },
  { provider: "ashby", slug: "featherlessai", company: "Featherless AI" },
  { provider: "lever", slug: "activetheory", company: "Active Theory" },
  { provider: "greenhouse", slug: "aplayers", company: "A-Players" },
  { provider: "greenhouse", slug: "defuselabs", company: "Defuse Labs" },
  { provider: "lever", slug: "swapcard", company: "Swapcard" },
  { provider: "greenhouse", slug: "saasgroup", company: "saas.group" },
  { provider: "greenhouse", slug: "tide", company: "Tide" },
  { provider: "greenhouse", slug: "pingidentity", company: "Ping Identity" },
  { provider: "greenhouse", slug: "arizeai", company: "Arize AI" },
  { provider: "ashby", slug: "vclusterlabs", company: "vCluster Labs" },
  { provider: "greenhouse", slug: "binance", company: "Binance" },
  { provider: "greenhouse", slug: "correlationone", company: "Correlation One" },
  { provider: "greenhouse", slug: "okx", company: "OKX" },
  { provider: "lever", slug: "quantummetric", company: "Quantum Metric" },
  { provider: "greenhouse", slug: "imagineworldwide", company: "Imagine Worldwide" },
  { provider: "greenhouse", slug: "pubnub", company: "PubNub" },
  { provider: "ashby", slug: "colonist", company: "Colonist" },
  { provider: "greenhouse", slug: "flyzipline", company: "Zipline" },
  { provider: "greenhouse", slug: "gropyus", company: "GROPYUS" },
  { provider: "greenhouse", slug: "planetscale", company: "PlanetScale" },
  { provider: "greenhouse", slug: "kayzen", company: "Kayzen" },
  { provider: "greenhouse", slug: "boosta", company: "Boosta" },
  { provider: "ashby", slug: "onhires", company: "OnHires" },
  { provider: "greenhouse", slug: "firstprinciples", company: "FirstPrinciples" },
  { provider: "greenhouse", slug: "zscaler", company: "Zscaler" },
  { provider: "ashby", slug: "revenuebase-inc", company: "RevenueBase Inc" },
  { provider: "greenhouse", slug: "refurbed", company: "refurbed" },
  // AI-training work published on public boards (micro1, Invisible, Outlier,
  // Mindrift and Alignerr only show work after sign-up; micro1/Invisible roles
  // still arrive through Himalayas).
  { provider: "greenhouse", slug: "xai", company: "xAI" },
  { provider: "ashby", slug: "g2i", company: "G2i" },
];
