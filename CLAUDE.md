# job-hunt

Surafel's search for a **fully remote full-stack job, at least $3,000/month, with an
employer willing to hire someone living in Ethiopia (UTC+3)**. One such offer = goal reached.

## Ground rules

- **Spend nothing.** No paid tools, Upwork Connects, paid auto-apply, Premium, or
  services that require a card.
- **Verify country eligibility before recommending a platform.** Mercor does not
  onboard Ethiopia (its own docs). PayPal can't receive money in Ethiopia; prefer
  Deel, Payoneer or SWIFT payment.
- **Never commit or push** unless the user asks for that specific commit.
- High-volume applying is fine; channels with few listings aren't worth the time.
- Warn about fake-recruiter malware: take-home repos run only in a container or VM.

## What's here

- **Next.js 16 + Postgres (Drizzle, `casing: "snake_case"`) app**, meant to be deployed on
  Vercel Hobby + Neon free, with Google sign-in via better-auth limited to `ALLOWED_EMAILS`.
  It replaced the local JSON version on 2026-11-02. The purpose of the database is to find
  the bottleneck (volume → replies → screens → interviews).
- `src/db/schema.ts`: companies (employer/agency), jobs (kept forever), job_sightings
  (each board a job appeared on), fetch_runs + fetch_run_sources (per-source yield and
  filter drops), applications + application_events (status derived from events),
  resume_versions, source_visits; plus the auth tables. Migrations live in `drizzle/`.
  Production build runs `drizzle-kit migrate`.
- `src/lib/jobs/`: sources, filters, `pipeline.ts`, `ingest.ts` (upsert + sightings),
  `refresh.ts` (one run at a time), `tracking.ts` (writes), `queries.ts` (reads +
  dashboard), `funnel.ts` (status, rates, `findBottleneck`), `import-old.ts` (from the
  old data/db.json). Every function takes `db`, so tests use PGlite (`test/helpers/pglite.ts`).
  These files also run under Node type stripping: relative `.ts` imports and `import type`.
- `src/app/(app)/`: Jobs, Applications, Dashboard, Check by hand, Settings.
  `src/app/actions.ts` holds the Server Actions: each calls `requireUser()` and validates
  with zod. `api/cron/fetch` is the Vercel Cron target (04:00 UTC, `CRON_SECRET`).
- The better-auth schema has no `account.issuer`; better-auth 1.7.15 rejects it.
- Planned for a second pass: interview details, outreach/referrals, talent networks, offers.
- `resume/surafel-getachew-resume.tex`: the one full-stack resume (LaTeX). The user
  rejected adding a location or headline to the header (fears ATS reads it as
  "not open to remote"). Keep the original header and summary.
- Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run db:generate`. Don't run `npm run dev` or start Postgres: the user starts
  services themselves.

## User preferences

- Wants fully remote roles that don't require citizenship/residency and pay in USD;
  happy with US/Europe companies. Digest tiers: ✅ open, 🟡 EMEA/time zone,
  ❔ just "Remote", 🔵 US/Europe-listed with no stated requirement.
- LinkedIn searches: no `location=Ethiopia` (it means jobs located in Ethiopia);
  phrase AI search as "fully remote", not "candidates in Ethiopia".

## Findings so far (2026-10-12/13)

- Himalayas aggregates from company career pages and ATSs plus direct posts. Some of
  its "jobs" are agencies or boilerplate repeat posters (Hivex ×10, Human Power BG):
  mark them as agencies; the dashboard compares reply rates by company type.
- Himalayas' REST API `pubDate`/`expiryDate` are reset whenever it re-checks a job: 4 of 5
  "posted this week" jobs were really posted Jul–Sep (2026-11-02). Its MCP server
  (`mcp.himalayas.app/mcp`, `search_jobs`, no account) shows the real posting day, as the
  job page does, and sorts by it (2026-11-17: 94 of 125 jobs differed, MCP always
  earlier). So the job data comes from REST and the date from MCP, read only back to the
  7-day cutoff; jobs the MCP doesn't list are older and left out. Limits without an
  account: 30 MCP lookups a minute, 200 a day per network (a run uses 10–15). The earlier
  "date only jobs that are new since the last full read" rule was wrong (old jobs
  re-entered the results with fresh dates) and is gone. The ~40 company boards of
  Himalayas' Ethiopia-friendly companies are in `atsBoards`; ingest keeps the earliest date.
- Source added 2026-11-11: Jobgether (`/astroapi/ai/jobs.json`, allowed by its robots.txt,
  2 s crawl delay) with `locations=ethiopia`: ~16 dev jobs a week, all EMEA/Africa/Anywhere,
  about a third already found elsewhere. No description and its job pages return 403, so
  title-only jobs skip the stack check and the score floor. Checked and rejected the same
  day: Career Hound (paid, no API), Crypto Jobs List (mostly on-site/US), Cryptocurrency
  Jobs, Jobspresso, NoDesk, Authentic Jobs (a few jobs a week), remote.co (403),
  findwork.dev and web3.career (need sign-up), and Remote In Tech's "worldwide" companies
  (233 found, 50 on Greenhouse/Ashby/Lever; 5 matches in 30 days, all US-listed).
- Sources added 2026-11-02: Remote First Jobs (~50 matches a week) and 4dayweek
  (~12, mostly 🔵). Rejected: Glassdoor (no API, 403), Get on Board (Latin America,
  1 match a week).
- Himalayas produces most eligible matches. Remotive, RemoteOK, Jobicy and the
  company boards produce about zero. Arc gives a few a week. Wellfound returns
  403 to scripts, so it's manual (email alerts only).
- With strict filters there are about 5–15 genuinely new matches a day, so
  LinkedIn alerts are needed for volume. The first 7-day fetch with the 🔵 tier
  gave 82 jobs (43 ✅, 38 🔵).
- Sources added 2026-10-15: Workable job search (~20 🔵 a week) and Working Nomads
  (Proxify roles, 🟡 CET ± 3h). Rejected after checking: YC jobs (mostly US-citizen
  only), LinkedIn guest API (ignores Remote, against ToS), Wellfound, Toptal and
  startup.jobs (403), Remote Africa, Dynamite, RemoteLeaf and JustRemote (client-rendered),
  Arbeitnow and Landing.jobs (on-site EU).
- Free social feeds (Bluesky, Mastodon, Reddit RSS) are mostly bots reposting
  board jobs, or low-paid r/forhire posts, so they're not worth automating.
  LinkedIn and X posts need a login, so they're manual.
- LinkedIn has been retiring classic (filter/Boolean) search since September 2026
  in favour of AI search. The user's old URL used geoId=103644278, which is the
  **United States**. The user wants one LinkedIn search: EMEA = geoId 91000007
  (91000000 is the European Union, 92000000 Worldwide), Remote, Easy Apply, past 24h.
- AI-training roles open to Ethiopia: micro1 (pays through Deel), Invisible,
  G2i (AI code reviewer), xAI tutors. Outlier and DataAnnotation are doubtful
  for Ethiopia.

## Status / next steps

- [ ] User: deploy (README → Deploy), then `npm run db:import-json` against Neon.

- [ ] User: compile the resume (Overleaf).
- [ ] Apply: Arc, micro1 and Andela now. Toptal and Crossover after DSA and aptitude-test prep.
- [ ] Set up LinkedIn job alerts (Worldwide, US, EU — all Remote); the searches are in the "Check by hand" tab.
- [ ] Still open: is the OpenTeams role ending? That changes urgency and the resume's "Present".
