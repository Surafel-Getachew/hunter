import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annualUsdCeiling, formatSalary } from "../src/lib/jobs/filters/salary.ts";
import { evaluate } from "../src/lib/jobs/filters/score.ts";
import type { Job } from "../src/lib/jobs/types.ts";

const now = new Date("2026-10-12T06:00:00Z");
const base: Job = {
  id: "t",
  source: "test",
  title: "Senior Full Stack Engineer",
  company: "Acme",
  url: "https://example.com",
  locations: ["Worldwide"],
  description: "React, Next.js, Node.js, TypeScript",
  postedAt: new Date("2026-10-11T00:00:00Z"),
};

describe("salary", () => {
  it("normalises to annual USD", () => {
    assert.equal(annualUsdCeiling({ min: 20, max: 30, period: "hourly", currency: "USD" }), 60_000);
    assert.equal(annualUsdCeiling({ min: 2000, max: null, period: "monthly", currency: "USD" }), 24_000);
    assert.equal(annualUsdCeiling({ min: null, max: null, period: "annual", currency: "USD" }), null);
    assert.equal(annualUsdCeiling({ min: 50_000, max: 60_000, period: "annual", currency: "XYZ" }), null);
  });

  it("formats ranges", () => {
    assert.equal(formatSalary({ min: 60_000, max: 90_000, period: "annual", currency: "USD" }), "$60k–90k/yr");
    assert.equal(formatSalary({ min: 40, max: 40, period: "hourly", currency: "USD" }), "$40/hr");
    assert.equal(formatSalary(undefined), null);
  });
});

describe("evaluate", () => {
  it("keeps a strong match", () => {
    const v = evaluate(base, { now });
    assert.equal(v.keep, true);
  });

  it("keeps postings without a description on the title alone, whatever their score", () => {
    const v = evaluate({ ...base, description: "", locations: ["EMEA"] }, { now });
    assert.equal(v.keep, true);
    assert.ok(v.keep && v.job.score < 6);
    assert.equal(evaluate({ ...base, title: "Senior Software Engineer", description: "" }, { now }).keep, false);
  });

  it("drops postings below the salary floor", () => {
    const v = evaluate({ ...base, salary: { min: 1000, max: 1500, period: "monthly", currency: "USD" } }, { now });
    assert.equal(v.keep, false);
    assert.equal(!v.keep && v.stage, "salary");
  });

  it("keeps postings with no stated salary", () => {
    assert.equal(evaluate({ ...base, salary: undefined }, { now }).keep, true);
  });

  it("drops stale postings", () => {
    const v = evaluate({ ...base, postedAt: new Date("2026-08-01T00:00:00Z") }, { now });
    assert.equal(!v.keep && v.stage, "age");
  });

  it("drops restricted locations, keeps bare 'Remote' and US/Europe-listed jobs", () => {
    assert.equal(evaluate({ ...base, locations: ["India"] }, { now }).keep, false);
    const remote = evaluate({ ...base, locations: ["Remote"] }, { now });
    assert.ok(remote.keep && remote.job.eligibility === "unknown");
    const us = evaluate({ ...base, locations: ["Remote - US"] }, { now });
    assert.ok(us.keep && us.job.eligibility === "possible");
  });

  it("ranks open > likely > just 'Remote' > US/Europe-listed", () => {
    const scores = [["Worldwide"], ["EMEA"], ["Remote"], ["Remote - US"]].map((locations) => {
      const v = evaluate({ ...base, locations }, { now });
      assert.ok(v.keep);
      return v.job.score;
    });
    assert.deepEqual([...scores].sort((a, b) => b - a), scores);
    assert.ok(new Set(scores).size === scores.length);
  });

  it("drops jobs a source marks as not open to Ethiopia, and relocation roles", () => {
    assert.equal(evaluate({ ...base, eligibilityHint: "restricted", locations: ["US, CA"] }, { now }).keep, false);
    assert.equal(evaluate({ ...base, title: "Senior Full Stack Engineer - Relocation to SF" }, { now }).keep, false);
  });
});

describe("evaluate with an hours window", () => {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("keeps postings inside the window and drops older ones", () => {
    assert.equal(evaluate({ ...base, postedAt: hoursAgo(5) }, { now, maxAgeHours: 12 }).keep, true);
    const old = evaluate({ ...base, postedAt: hoursAgo(13) }, { now, maxAgeHours: 12 });
    assert.equal(!old.keep && old.stage, "age");
  });

  it("drops undated postings when a window is set", () => {
    assert.equal(evaluate({ ...base, postedAt: null }, { now, maxAgeHours: 24 }).keep, false);
    assert.equal(evaluate({ ...base, postedAt: null }, { now }).keep, true);
  });
});

describe("AI-training roles", () => {
  const trainer = (title: string, description: string) => ({ ...base, title, description });

  it("files coding AI-training roles in their own section, even Python ones", () => {
    const v = evaluate(trainer("Python Coding Specialist - AI Trainer", "Help train AI models with Python."), { now });
    assert.ok(v.keep && v.job.category === "ai-training");
    const tutor = evaluate(trainer("AI Tutor - Software Engineer Specialist", "Improve LLM coding."), { now });
    assert.ok(tutor.keep && tutor.job.category === "ai-training");
    const reviewer = evaluate(trainer("Python Engineer, AI Code Reviewer", "Review code written by AI models."), { now });
    assert.ok(reviewer.keep && reviewer.job.category === "ai-training");
  });

  it("skips the salary floor for AI-training roles", () => {
    const v = evaluate(
      { ...trainer("AI Trainer - Coding", "Evaluate JavaScript written by LLMs."), salary: { min: 15, max: 15, period: "hourly", currency: "USD" } },
      { now },
    );
    assert.ok(v.keep && v.job.category === "ai-training");
  });

  it("leaves out country-specific AI-training contracts for the US/Europe", () => {
    const v = evaluate({ ...trainer("Senior Software Engineer, AI Training - US", "Train AI models."), locations: ["Remote"] }, { now });
    assert.equal(v.keep, false);
  });

  it("leaves out non-coding trainer roles", () => {
    assert.equal(evaluate(trainer("Oromo Language Specialist - AI Trainer", "Native Oromo speakers."), { now }).keep, false);
    assert.equal(evaluate(trainer("AI Tutor - Humanities", "History and philosophy."), { now }).keep, false);
    const audio = trainer("Audio Specialist - Freelance AI Trainer Project", "Python scripting is a plus.");
    assert.equal(evaluate(audio, { now }).keep, false);
  });

  it("keeps ordinary full-stack roles in the main section", () => {
    const v = evaluate(base, { now });
    assert.ok(v.keep && v.job.category === "main");
  });
});
