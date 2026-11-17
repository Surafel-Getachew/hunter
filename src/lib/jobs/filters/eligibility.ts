import type { Eligibility, Job } from "../types.ts";

export interface EligibilityResult {
  status: Eligibility;
  reason: string;
}

/** Countries/regions that, when named as a requirement, exclude someone living in Ethiopia. */
const PLACES = [
  "us",
  "u\\.s\\.?",
  "usa",
  "united states",
  "america",
  "americas",
  "north america",
  "canada",
  "uk",
  "u\\.k\\.?",
  "united kingdom",
  "britain",
  "eu",
  "e\\.u\\.?",
  "europe",
  "european union",
  "eea",
  "latam",
  "latin america",
  "south america",
  "apac",
  "asia",
  "india",
  "brazil",
  "mexico",
  "germany",
  "france",
  "spain",
  "portugal",
  "poland",
  "netherlands",
  "ireland",
  "israel",
  "australia",
  "new zealand",
  "philippines",
  "pakistan",
  "singapore",
  "japan",
].join("|");

/**
 * US/Canada/UK/European markets. A remote job listed only for these is kept as
 * "possible" when the posting states no residency/citizenship requirement.
 */
const WESTERN_PLACES = [
  "us",
  "u\\.s\\.?",
  "usa",
  "united states",
  "america",
  "americas",
  "north america",
  "namer",
  "amer",
  "canada",
  "uk",
  "u\\.k\\.?",
  "united kingdom",
  "britain",
  "england",
  "ireland",
  "europe",
  "european",
  "eu",
  "e\\.u\\.?",
  "european union",
  "eea",
  "dach",
  "nordics",
  "germany",
  "france",
  "spain",
  "portugal",
  "poland",
  "netherlands",
  "belgium",
  "luxembourg",
  "switzerland",
  "austria",
  "italy",
  "sweden",
  "norway",
  "denmark",
  "finland",
  "iceland",
  "czech republic",
  "czechia",
  "slovakia",
  "slovenia",
  "hungary",
  "romania",
  "bulgaria",
  "greece",
  "croatia",
  "estonia",
  "latvia",
  "lithuania",
  "cyprus",
  "malta",
].join("|");

/** ISO codes for the same markets, for sources that list allowed countries (Arc). */
export const WESTERN_COUNTRY_CODES = new Set(
  "US CA GB IE DE FR ES PT PL NL BE LU CH AT IT SE NO DK FI IS CZ SK SI HU RO BG GR HR EE LV LT CY MT".split(" "),
);

const WESTERN = new RegExp(`\\b(${WESTERN_PLACES})\\b`, "i");
const WESTERN_ALL = new RegExp(`\\b(${WESTERN_PLACES})\\b`, "gi");
const CONNECTIVES = /\b(or|and|only|anywhere|in|within|across|the|time\s?zones?|hours|overlap|est|cet|pst|et)\b/gi;

/** "Remote - US", "USA, Canada", "Remote within Europe" — every place named is a Western market. */
function onlyWesternPlaces(t: string): boolean {
  if (!WESTERN.test(t)) return false;
  return t.replace(WESTERN_ALL, "").replace(CONNECTIVES, "").replace(NEUTRAL_LOCATION_WORDS, "").length === 0;
}

/** Signs of a US-payroll employee role, which a contractor abroad can't fill. */
const US_PAYROLL = /\b401\s?\(?k\)?|\bw-?2\b|\bmedical,\s*dental,?\s*(and\s*)?vision\b/i;

const ETHIOPIA = /\bethiopia\b/i;
const AFRICA = /(?<!south\s)\bafrica\b|\bafrican\b/i;

/** "Anywhere in the US", "worldwide (except ...)" etc. read as open but aren't. */
const SCOPED_ANYWHERE = new RegExp(`\\b(anywhere|remote)\\s*(in|within|across|from)\\s+(the\\s+)?(${PLACES})\\b`, "i");

const OPEN_LOCATION =
  /\b(world\s?-?wide|anywhere|global|globally|international(ly)?|all countries|any country|any location|fully distributed|no location restrictions?)\b/i;

const EMEA = /\bemea\b|europe,?\s+middle east,?\s+(and|&)\s+africa/i;

/** UTC+0..+5 overlap, or explicit European/East-African time zones. */
const COMPATIBLE_TIMEZONE =
  /\b(utc|gmt)\s*[+±]\s*[0-5]\b|\b(cet|cest|eet|eest|eat)\b|\beuropean time\s?zones?\b|\b(utc|gmt)\s*[+-]?\s*\d+\s*(to|-|–)\s*(utc|gmt)?\s*\+\s*[3-9]/i;

/** Words that carry no location information on their own. "Hybrid"/"on-site" deliberately aren't here. */
const NEUTRAL_LOCATION_WORDS =
  /\b(remote|fully|first|only|home|based|work|from|distributed|position|role|job|team|ok|friendly)\b|100%|[-–—,;:/()|&+.]|\s+/gi;

/** Hard requirements in a description that rule out Ethiopia. */
const RESTRICTING_DESCRIPTION = [
  new RegExp(
    `\\b(must|should|need to|needs to|required to|are required to)\\s+(be\\s+)?(currently\\s+)?(located|based|residing|reside|live|living)\\s+(in|within)\\s+(the\\s+)?(${PLACES})\\b`,
    "i",
  ),
  new RegExp(`\\b(authori[sz]ed|eligible|legally able)\\s+to\\s+work\\s+in\\s+(the\\s+)?(${PLACES})\\b`, "i"),
  new RegExp(`\\b(only|exclusively)\\s+(open|available|accepting)\\s+(to\\s+)?(candidates|applicants|applications|residents)\\s+(in|from|based in|located in)\\s+(the\\s+)?(${PLACES})\\b`, "i"),
  // "US only" — case-sensitive so "work with us only" doesn't count.
  /\b(US|U\.S\.|USA|UK|EU|EEA|LATAM|APAC|NA)[- ](based\s+)?(candidates\s+|applicants\s+|residents\s+)?only\b/,
  /\b(united states|north america|canada|united kingdom|europe|latin america|americas)[- ](based\s+)?(candidates\s+|applicants\s+|residents\s+)?only\b/i,
  /\b(security clearance|w-?2 (employees?|only|position)|us citizens?(hip)?\s+(is\s+)?(only|required))\b/i,
  /\b(relocation|relocate)\s+to\b/i,
];

const OPEN_DESCRIPTION =
  /\b(anywhere in the world|work from anywhere|from anywhere in the world|hire (globally|worldwide|from anywhere|anywhere)|open to candidates (worldwide|globally|anywhere|from any country)|regardless of (your )?location|location[- ]independent|fully remote,? (worldwide|global))\b/i;

export function classifyLocation(text: string): EligibilityResult {
  const t = text.trim();
  if (!t) return { status: "unknown", reason: "no location stated" };
  if (ETHIOPIA.test(t)) return { status: "open", reason: "lists Ethiopia" };
  if (SCOPED_ANYWHERE.test(t)) {
    return onlyWesternPlaces(t) ? possible(t) : { status: "restricted", reason: `scoped: ${t}` };
  }
  if (OPEN_LOCATION.test(t)) return { status: "open", reason: t };
  if (EMEA.test(t)) return { status: "likely", reason: "EMEA – confirm Ethiopia is on their country list" };
  if (AFRICA.test(t)) return { status: "open", reason: `lists Africa: ${t}` };
  if (COMPATIBLE_TIMEZONE.test(t)) return { status: "likely", reason: `time zone based: ${t}` };
  if (t.replace(NEUTRAL_LOCATION_WORDS, "").length === 0) {
    return { status: "unknown", reason: "“Remote”, no location limits stated" };
  }
  if (onlyWesternPlaces(t)) return possible(t);
  return { status: "restricted", reason: t };
}

function possible(t: string): EligibilityResult {
  return { status: "possible", reason: `${t}: no residency or citizenship requirement stated` };
}

/** Best status across several location strings (a job listed as "US; Worldwide" is open). */
function bestOf(results: EligibilityResult[]): EligibilityResult {
  return results.reduce((best, r) => (RANK[r.status] > RANK[best.status] ? r : best));
}

/** Region at the end of a title: "Senior Engineer - UK", "AI Training (LATAM)". */
const TITLE_REGION =
  /[-–—|(,]\s*(US|USA|UK|CA|AU|NZ|LATAM|APAC|EMEA|EU|Europe|Canada|India|Brazil|Mexico|Australia|New Zealand|United States|United Kingdom|North America|Africa|Worldwide|Global)(\s+remote)?\)?\s*$/i;

const RANK: Record<Eligibility, number> = { open: 4, likely: 3, unknown: 2, possible: 1, restricted: 0 };

export function classifyJob(job: Job): EligibilityResult {
  const stated = job.locations.join(", ");
  let fromLocation: EligibilityResult = job.eligibilityHint
    ? { status: job.eligibilityHint, reason: stated || `${job.source} lists it as open to Ethiopia` }
    : job.locations.length > 0
      ? bestOf(job.locations.map(classifyLocation))
      : { status: "unknown", reason: "no location stated" };

  // Companies that post one opening per country put the country in the title.
  const titleRegion = job.title.match(TITLE_REGION)?.[1];
  if (titleRegion) {
    const fromTitle = classifyLocation(titleRegion);
    // It fills in a bare "Remote" location, and otherwise can only make it stricter.
    if (fromLocation.status === "unknown" || RANK[fromTitle.status] < RANK[fromLocation.status]) {
      fromLocation = { ...fromTitle, reason: `title says ${titleRegion}` };
    }
  }

  if (fromLocation.status === "restricted") return fromLocation;

  // The posting text overrides optimistic location labels ("Anywhere" boards
  // still carry postings that say "must be based in the US" further down).
  const text = `${job.title}\n${job.description}`;
  const restriction = RESTRICTING_DESCRIPTION.map((re) => text.match(re)).find(Boolean);
  if (restriction) return { status: "restricted", reason: `posting says “${restriction[0]}”` };

  if (fromLocation.status === "possible" && US_PAYROLL.test(job.description)) {
    return { status: "restricted", reason: "US-payroll employee role (401(k)/W-2/benefits)" };
  }

  if (fromLocation.status === "unknown" && OPEN_DESCRIPTION.test(job.description)) {
    return { status: "open", reason: "description says they hire from anywhere" };
  }
  return fromLocation;
}
