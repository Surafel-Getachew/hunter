import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  breakdown,
  deriveStatus,
  findBottleneck,
  outcomeOf,
  speedBucket,
  totals,
  type FunnelApplication,
  type FunnelEvent,
} from "../src/lib/jobs/funnel.ts";
import type { EventType } from "../src/lib/jobs/model.ts";

const now = new Date("2026-11-02T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const ev = (type: EventType, day: number): FunnelEvent => ({ type, occurredAt: daysAgo(day) });

const app = (events: FunnelEvent[], extra: Partial<FunnelApplication> = {}): FunnelApplication => ({
  appliedAt: daysAgo(30),
  postedAt: daysAgo(31),
  channel: "company_site",
  eligibility: "open",
  source: "Himalayas",
  companyKind: "employer",
  resumeVersion: "v1",
  events: [ev("applied", 30), ...events],
  ...extra,
});

describe("deriveStatus", () => {
  it("follows the furthest stage reached", () => {
    assert.equal(deriveStatus([ev("applied", 5)]), "applied");
    assert.equal(deriveStatus([ev("applied", 5), ev("recruiter_reply", 4)]), "screening");
    assert.equal(deriveStatus([ev("applied", 5), ev("technical_interview", 3), ev("screen", 2)]), "interviewing");
    assert.equal(deriveStatus([ev("applied", 5), ev("offer", 1)]), "offer");
  });

  it("ends on a rejection or withdrawal, and a later round reopens it", () => {
    assert.equal(deriveStatus([ev("applied", 5), ev("screen", 4), ev("rejected", 3)]), "rejected");
    assert.equal(deriveStatus([ev("applied", 5), ev("withdrawn", 3)]), "withdrawn");
    assert.equal(deriveStatus([ev("applied", 9), ev("rejected", 8), ev("technical_interview", 2)]), "interviewing");
  });

  it("ignores notes and follow-ups", () => {
    assert.equal(deriveStatus([ev("applied", 5), ev("note", 4), ev("follow_up", 3)]), "applied");
  });
});

describe("outcomes and totals", () => {
  it("separates positive replies, rejections, waiting and silence", () => {
    const o = (events: FunnelEvent[], appliedDaysAgo = 30) => outcomeOf(app(events, { appliedAt: daysAgo(appliedDaysAgo) }), now);
    assert.deepEqual(
      { ...o([ev("recruiter_reply", 25)]), daysToFirstResponse: undefined },
      { responded: true, positive: true, interviewed: false, offered: false, rejected: false, awaiting: false, noReply: false, daysToFirstResponse: undefined },
    );
    assert.equal(o([ev("rejected", 28)]).positive, false);
    assert.equal(o([ev("rejected", 28)]).responded, true);
    assert.equal(o([], 5).awaiting, true);
    assert.equal(o([], 30).noReply, true);
    assert.equal(o([ev("recruiter_reply", 25)]).daysToFirstResponse, 5);
  });

  it("computes stage conversion rates", () => {
    const apps = [
      app([ev("screen", 20), ev("technical_interview", 15), ev("offer", 5)]),
      app([ev("recruiter_reply", 20), ev("rejected", 10)]),
      app([ev("rejected", 25)]),
      app([]),
    ];
    const t = totals(apps, apps.map((a) => outcomeOf(a, now)));
    assert.equal(t.applications, 4);
    assert.equal(t.positive, 2);
    assert.equal(t.interviewed, 1);
    assert.equal(t.offered, 1);
    assert.equal(t.responseRate, 0.5);
    assert.equal(t.screenToInterview, 0.5);
    assert.equal(t.interviewToOffer, 1);
    assert.equal(t.noReply, 1);
  });
});

describe("breakdowns", () => {
  it("groups by any dimension and sorts by volume", () => {
    const apps = [app([ev("screen", 20)], { channel: "referral" }), app([], { channel: "easy_apply" }), app([], { channel: "easy_apply" })];
    const rows = breakdown(apps, apps.map((a) => outcomeOf(a, now)), (a) => a.channel);
    assert.deepEqual(rows.map((r) => [r.key, r.applications, r.positiveRate]), [
      ["easy_apply", 2, 0],
      ["referral", 1, 1],
    ]);
  });

  it("buckets how soon after posting you applied", () => {
    const at = (hoursAfter: number | null) =>
      speedBucket({ appliedAt: now, postedAt: hoursAfter == null ? null : new Date(now.getTime() - hoursAfter * 3_600_000) });
    assert.deepEqual([at(5), at(30), at(100), at(400), at(null)], ["Under 24 hours", "1–3 days", "3–7 days", "Over a week", "Unknown"]);
  });
});

describe("findBottleneck", () => {
  const verdict = (apps: FunnelApplication[], applicationsLast7Days: number, matchesLast7Days = 100) => {
    const outcomes = apps.map((a) => outcomeOf(a, now));
    return findBottleneck({
      totals: totals(apps, outcomes),
      applicationsLast7Days,
      matchesLast7Days,
      bySpeed: breakdown(apps, outcomes, speedBucket),
      byTier: breakdown(apps, outcomes, (a) => a.eligibility),
      byChannel: breakdown(apps, outcomes, (a) => a.channel),
    }).stage;
  };
  const many = (n: number, events: (i: number) => FunnelEvent[]) => Array.from({ length: n }, (_, i) => app(events(i)));

  it("says volume until there are enough applications", () => {
    assert.equal(verdict(many(5, () => []), 5), "volume");
    assert.equal(verdict(many(60, () => []), 10), "volume");
  });

  it("points at replies when volume is fine but almost nobody answers", () => {
    assert.equal(verdict(many(60, () => []), 40), "response");
  });

  it("points at screens when replies don't become interviews", () => {
    assert.equal(verdict(many(60, (i) => (i < 10 ? [ev("screen", 20)] : [])), 40), "screens");
  });

  it("points at interviews when interviews don't become offers", () => {
    assert.equal(verdict(many(60, (i) => (i < 10 ? [ev("technical_interview", 20)] : [])), 40), "interviews");
  });

  it("is on track when every stage converts", () => {
    assert.equal(verdict(many(60, (i) => (i < 10 ? [ev("technical_interview", 20)] : i < 12 ? [ev("offer", 5)] : [])), 40), "on_track");
  });
});
