# job-hunt

Finds fully remote full-stack jobs you can get from Ethiopia, records every
application and what happened after, and shows where the search stalls.

Next.js 16 + PostgreSQL (Drizzle), deployed on Vercel with Neon, signed in with
Google and limited to your own account. Everything runs on free tiers.

## Pages

- **Jobs**: new matches from the last 7 days, best first. Filter by who the job
  is open to, role type, posting age, source, or search. Each job has these actions:
  - **Applied**: records how you applied, which CV version, whether it was
    tailored, and when.
  - **Save**
  - **Hide**: you pick a reason, which shows which filters let the wrong jobs through.

  **Log an application** records jobs you found elsewhere (LinkedIn, X,
  referrals), so they count too. **Fetch now** checks every source in about 20 seconds.
- **Applications**: one timeline per application. Add what happened (recruiter
  reply, screen, technical interview, take-home, final round, offer, rejection,
  withdrew, follow-up, note), whether the job really was open to you, the rate you
  asked for, notes, and whether the company is an employer or an agency.
- **Dashboard**:
  - The bottleneck, checked in funnel order: volume, then replies, then screens,
    then interviews.
  - Weekly matches found against applications sent.
  - The funnel from applied to offer.
  - Reply rates by who the job is open to, how soon you applied, how you applied,
    source, CV version and company type.
  - Each source's yield, and why you skip jobs.
- **Check by hand**: sites the app can't fetch, with a reminder when each is due.
- **Settings**: CV versions, so reply rates can be compared by CV.

Nothing is deleted. Old jobs drop out of the default view, but stay in the
database for the statistics.

## Run it locally

You start the database yourself, for example the brew `postgresql@14` on port 5433
that Galatea uses (`brew services start postgresql@14`). Then:

```sh
createdb -p 5433 jobhunt
cp .env.example .env          # fill in the values (see below)
npm install
npm run db:migrate            # create the tables
npm run db:import-json        # optional: move data/db.json from the old version in
npm run dev                   # http://localhost:3000
```

For local Google sign-in, add `http://localhost:3000/api/auth/callback/google` as
an authorised redirect URI on your OAuth client.

## Deploy (Vercel + Neon, free)

1. **Push this repo** to a private GitHub repository and import it in Vercel (Hobby plan).
2. **Database.** In the Vercel project, open *Storage → Neon* and create a free
   database. It sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` for you.
3. **Google sign-in.** In Google Cloud Console (*APIs & Services → Credentials*),
   create an OAuth client. Use a new one, not Galatea's. Add this redirect URI:
   `https://<your-app>.vercel.app/api/auth/callback/google`.
4. **Environment variables** in Vercel (*Settings → Environment Variables*):

   | Name | Value |
   |---|---|
   | `BETTER_AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from step 3 |
   | `ALLOWED_EMAILS` | your Google address. Nobody else can sign in. |
   | `CRON_SECRET` | any long random string |

5. **Redeploy.** Production builds run the migrations (`drizzle-kit migrate`) before `next build`.
6. **Bring your old data over** (once), from your machine:
   ```sh
   DATABASE_URL="<Neon's unpooled URL>" npm run db:import-json
   ```

Vercel Cron calls `/api/cron/fetch` daily around 04:00 UTC (07:00 in Addis Ababa;
see `vercel.json`). It sends `CRON_SECRET`, and requests without it get a 401.

## What gets fetched and filtered

**Sources:**
- **Himalayas** (searched with its Ethiopia filter). Its API resets a job's date
  whenever it re-checks it, so the real posting date comes from Himalayas' MCP server,
  which allows 200 lookups a day without an account (a fetch uses 10–15).
- **Arc**
- **Jobgether** (free API, searched for jobs it lists as open to Ethiopia). It gives no
  description, so these jobs are judged by title alone.
- **Workable**
- **Remote First Jobs** (free API: 500 postings, a day after publication)
- **4dayweek** (free API: remote engineering jobs from the last week)
- **We Work Remotely**
- **Working Nomads**
- **Remotive**
- **RemoteOK**
- **Jobicy**
- **HN "Who is hiring?"**
- **Company career pages** (Greenhouse, Ashby, Lever): about 55 companies, most of them
  ones Himalayas lists as hiring from Ethiopia, plus xAI and G2i for AI-training work

The lists are in `src/lib/jobs/config.ts`. Each fetch records, per source, what came
in and how many postings each filter dropped (`fetch_run_sources`).

**Filtered out:**
- Postings that require residency, citizenship or work authorisation ("must be
  located in…", "authorized to work in…", "US only", security clearance, relocation)
- US-payroll roles (401(k), W-2, medical/dental/vision)
- Regions that exclude Ethiopia, and hybrid or on-site roles
- Off-stack or wrong-level roles
- Stated pay below $3,000/month (AI-training contracts are exempt)

**Who each job is open to** (hover the badge for the reason):
- ✅ worldwide or Africa
- 🟡 EMEA or a nearby time zone
- ❔ just "Remote"
- 🔵 listed for the US or Europe, with no citizenship requirement stated

Wellfound, LinkedIn and X can't be fetched; they're on the "Check by hand" page.

## The data

`src/db/schema.ts` describes every table. In short:

| Table | What it holds | What it answers |
|---|---|---|
| `fetch_runs`, `fetch_run_sources` | Each fetch, per source: postings fetched, matched, dropped per filter, failures | Which sources are worth keeping |
| `companies` | One row per company, marked employer, agency or talent network | Do agencies ever reply? |
| `jobs`, `job_sightings` | Every match, kept for good, plus each board it appeared on | Supply, and where replies come from |
| `applications`, `application_events` | When and how you applied, CV version, tailoring, and a dated event per step | Reply rate, stage conversion, speed |
| `resume_versions` | CV versions | Does a CV change move the reply rate? |
| `source_visits` | Each visit to a "Check by hand" site | Effort |

Planned for later: interview details (round, questions, feedback), outreach and
referrals, talent-network vetting, and offers.

## Development

```sh
npm test            # filters, funnel maths, and the database layer on PGlite (in-process Postgres)
npm run typecheck
npm run lint
npm run build
npm run fetch:dry   # fetch and print the best matches without saving
npm run fetch       # fetch into DATABASE_URL
npm run db:generate # after changing src/db/schema.ts
```

The fetch code in `src/lib/jobs/` and `src/db/` also runs directly under Node 24's
type stripping (scripts and tests), so it uses relative `.ts` imports and
`import type` for types.
