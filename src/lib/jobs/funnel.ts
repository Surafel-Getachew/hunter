// Funnel analysis: where applications stall. Pure and client-safe.
import type { ApplicationChannel, ApplicationStatus, CompanyKind, EventType } from "./model.ts";
import type { Eligibility } from "./types.ts";

const DAY_MS = 86_400_000;

/** An application with no reply this long after applying counts as "no reply". */
export const NO_REPLY_AFTER_DAYS = 21;

export interface FunnelEvent {
  type: EventType;
  occurredAt: Date;
}

const SCREENING: ReadonlySet<EventType> = new Set(["recruiter_reply", "screen"]);
const INTERVIEWING: ReadonlySet<EventType> = new Set(["technical_interview", "take_home", "final_interview"]);
const POSITIVE: ReadonlySet<EventType> = new Set([...SCREENING, ...INTERVIEWING, "offer", "accepted"]);
const INTERVIEWED: ReadonlySet<EventType> = new Set([...INTERVIEWING, "offer", "accepted"]);
const OFFERED: ReadonlySet<EventType> = new Set(["offer", "accepted"]);

const STAGE_RANK: Record<ApplicationStatus, number> = {
  applied: 0,
  screening: 1,
  interviewing: 2,
  offer: 3,
  accepted: 4,
  rejected: -1,
  withdrawn: -1,
};

function stageOf(type: EventType): ApplicationStatus | null {
  if (type === "accepted") return "accepted";
  if (type === "offer") return "offer";
  if (INTERVIEWING.has(type)) return "interviewing";
  if (SCREENING.has(type)) return "screening";
  if (type === "rejected" || type === "withdrawn") return type;
  return null;
}

/**
 * The furthest stage reached, unless the latest stage event is a rejection or
 * withdrawal. A later positive event (a new round) reopens it.
 */
export function deriveStatus(events: FunnelEvent[]): ApplicationStatus {
  const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  let status: ApplicationStatus = "applied";
  let furthest: ApplicationStatus = "applied";
  for (const event of ordered) {
    const stage = stageOf(event.type);
    if (!stage) continue;
    if (stage === "rejected" || stage === "withdrawn") {
      status = stage;
      continue;
    }
    if (STAGE_RANK[stage] > STAGE_RANK[furthest]) furthest = stage;
    status = furthest;
  }
  return status;
}

export interface FunnelApplication {
  appliedAt: Date;
  postedAt: Date | null;
  channel: ApplicationChannel;
  eligibility: Eligibility;
  source: string;
  companyKind: CompanyKind;
  resumeVersion: string | null;
  events: FunnelEvent[];
}

export interface Outcome {
  /** Any answer, including a rejection. */
  responded: boolean;
  /** A reply that moved it forward: recruiter reply, screen or later. */
  positive: boolean;
  interviewed: boolean;
  offered: boolean;
  rejected: boolean;
  /** No answer yet, applied less than three weeks ago. */
  awaiting: boolean;
  /** No answer after three weeks. */
  noReply: boolean;
  daysToFirstResponse: number | null;
}

export function outcomeOf(app: FunnelApplication, now: Date): Outcome {
  const has = (set: ReadonlySet<EventType>) => app.events.some((e) => set.has(e.type));
  const responses = app.events.filter((e) => POSITIVE.has(e.type) || e.type === "rejected");
  const first = responses.reduce<Date | null>((min, e) => (!min || e.occurredAt < min ? e.occurredAt : min), null);
  const responded = responses.length > 0;
  const ageDays = (now.getTime() - app.appliedAt.getTime()) / DAY_MS;
  return {
    responded,
    positive: has(POSITIVE),
    interviewed: has(INTERVIEWED),
    offered: has(OFFERED),
    rejected: app.events.some((e) => e.type === "rejected"),
    awaiting: !responded && ageDays < NO_REPLY_AFTER_DAYS,
    noReply: !responded && ageDays >= NO_REPLY_AFTER_DAYS,
    daysToFirstResponse: first ? Math.max(0, (first.getTime() - app.appliedAt.getTime()) / DAY_MS) : null,
  };
}

export const SPEED_BUCKETS = ["Under 24 hours", "1–3 days", "3–7 days", "Over a week", "Unknown"] as const;
export type SpeedBucket = (typeof SPEED_BUCKETS)[number];

/** How long after the posting went up you applied. */
export function speedBucket(app: Pick<FunnelApplication, "appliedAt" | "postedAt">): SpeedBucket {
  if (!app.postedAt) return "Unknown";
  const hours = (app.appliedAt.getTime() - app.postedAt.getTime()) / 3_600_000;
  if (hours < 24) return "Under 24 hours";
  if (hours < 72) return "1–3 days";
  if (hours < 168) return "3–7 days";
  return "Over a week";
}

export interface BreakdownRow {
  key: string;
  applications: number;
  positive: number;
  interviews: number;
  positiveRate: number | null;
}

export function breakdown(
  apps: FunnelApplication[],
  outcomes: Outcome[],
  keyOf: (app: FunnelApplication) => string,
): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  apps.forEach((app, i) => {
    const key = keyOf(app);
    const row = rows.get(key) ?? { key, applications: 0, positive: 0, interviews: 0, positiveRate: null };
    row.applications++;
    if (outcomes[i]!.positive) row.positive++;
    if (outcomes[i]!.interviewed) row.interviews++;
    rows.set(key, row);
  });
  return [...rows.values()]
    .map((r) => ({ ...r, positiveRate: r.applications ? r.positive / r.applications : null }))
    .sort((a, b) => b.applications - a.applications);
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface FunnelTotals {
  applications: number;
  responded: number;
  positive: number;
  interviewed: number;
  offered: number;
  rejected: number;
  noReply: number;
  awaiting: number;
  /** Positive replies per application. */
  responseRate: number | null;
  /** Interviews per positive reply. */
  screenToInterview: number | null;
  /** Offers per interviewed application. */
  interviewToOffer: number | null;
  medianDaysToFirstResponse: number | null;
}

export function totals(apps: FunnelApplication[], outcomes: Outcome[]): FunnelTotals {
  const count = (pick: (o: Outcome) => boolean) => outcomes.filter(pick).length;
  const positive = count((o) => o.positive);
  const interviewed = count((o) => o.interviewed);
  const offered = count((o) => o.offered);
  return {
    applications: apps.length,
    responded: count((o) => o.responded),
    positive,
    interviewed,
    offered,
    rejected: count((o) => o.rejected),
    noReply: count((o) => o.noReply),
    awaiting: count((o) => o.awaiting),
    responseRate: ratio(positive, apps.length),
    screenToInterview: ratio(interviewed, positive),
    interviewToOffer: ratio(offered, interviewed),
    medianDaysToFirstResponse: median(outcomes.flatMap((o) => (o.daysToFirstResponse == null ? [] : [o.daysToFirstResponse]))),
  };
}

export type BottleneckStage = "volume" | "response" | "screens" | "interviews" | "on_track";

export interface Verdict {
  stage: BottleneckStage;
  headline: string;
  detail: string;
}

/** Minimum applications before a response rate means anything. */
export const MIN_FOR_RESPONSE_RATE = 50;
const TARGET_WEEKLY_APPLICATIONS = 30;
const MIN_RESPONSE_RATE = 0.03;
const MIN_SCREEN_TO_INTERVIEW = 0.4;
const MIN_INTERVIEW_TO_OFFER = 0.15;

function pct(rate: number | null): string {
  return rate == null ? "–" : `${Math.round(rate * 100)}%`;
}

/** The best-converting group with enough applications to trust, for advice. */
function bestOf(rows: BreakdownRow[], minApplications = 10): BreakdownRow | null {
  return rows
    .filter((r) => r.applications >= minApplications && r.key !== "Unknown")
    .sort((a, b) => (b.positiveRate ?? 0) - (a.positiveRate ?? 0))[0] ?? null;
}

/**
 * The earliest stage that's underperforming, checked in funnel order: until
 * there's enough volume, later stages can't be judged.
 */
export function findBottleneck(input: {
  totals: FunnelTotals;
  applicationsLast7Days: number;
  matchesLast7Days: number;
  bySpeed: BreakdownRow[];
  byTier: BreakdownRow[];
  byChannel: BreakdownRow[];
}): Verdict {
  const { totals: t, applicationsLast7Days, matchesLast7Days } = input;

  if (t.applications < MIN_FOR_RESPONSE_RATE || applicationsLast7Days < TARGET_WEEKLY_APPLICATIONS) {
    return {
      stage: "volume",
      headline: "Volume: apply to more of what's found",
      detail:
        `${applicationsLast7Days} applications in the last 7 days against ${matchesLast7Days} new matches ` +
        `(target: ${TARGET_WEEKLY_APPLICATIONS}+ a week). ` +
        (t.applications < MIN_FOR_RESPONSE_RATE
          ? `With ${t.applications} applications in total, response rates aren't meaningful until about ${MIN_FOR_RESPONSE_RATE}.`
          : "Later stages look measurable; keep the weekly volume up while you work on them."),
    };
  }

  if ((t.responseRate ?? 0) < MIN_RESPONSE_RATE) {
    const slow = input.bySpeed.filter((r) => r.key === "3–7 days" || r.key === "Over a week").reduce((n, r) => n + r.applications, 0);
    const hints = [
      slow / t.applications > 0.3 ? `${Math.round((slow / t.applications) * 100)}% of applications went out 3+ days after posting; apply within a day.` : null,
      bestOf(input.byTier) ? `Best-responding tier: ${bestOf(input.byTier)!.key} (${pct(bestOf(input.byTier)!.positiveRate)}).` : null,
      bestOf(input.byChannel) ? `Best channel: ${bestOf(input.byChannel)!.key} (${pct(bestOf(input.byChannel)!.positiveRate)}).` : null,
    ].filter(Boolean);
    return {
      stage: "response",
      headline: "Replies: applications aren't getting answers",
      detail:
        `${pct(t.responseRate)} of ${t.applications} applications got a positive reply (target: ${pct(MIN_RESPONSE_RATE)}+). ` +
        `Look at the CV, targeting and speed before sending more. ${hints.join(" ")}`.trim(),
    };
  }

  if (t.positive >= 5 && (t.screenToInterview ?? 0) < MIN_SCREEN_TO_INTERVIEW) {
    return {
      stage: "screens",
      headline: "Screens: replies aren't turning into interviews",
      detail:
        `${t.interviewed} of ${t.positive} positive replies reached a technical interview (${pct(t.screenToInterview)}; target: ${pct(MIN_SCREEN_TO_INTERVIEW)}+). ` +
        "Check what comes up in recruiter calls: rate, location and contract terms, or how you pitch your experience.",
    };
  }

  if (t.interviewed >= 5 && (t.interviewToOffer ?? 0) < MIN_INTERVIEW_TO_OFFER) {
    return {
      stage: "interviews",
      headline: "Interviews: they aren't turning into offers",
      detail:
        `${t.offered} offers from ${t.interviewed} interview processes (${pct(t.interviewToOffer)}; target: ${pct(MIN_INTERVIEW_TO_OFFER)}+). ` +
        "Note the questions and feedback from each round to find the pattern, and practise those.",
    };
  }

  return {
    stage: "on_track",
    headline: "On track: keep the volume steady",
    detail: `${pct(t.responseRate)} reply rate, ${t.interviewed} interviews, ${t.offered} offers so far. No stage is underperforming yet.`,
  };
}
