import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyJob, classifyLocation } from "../src/lib/jobs/filters/eligibility.ts";
import type { Job } from "../src/lib/jobs/types.ts";

const job = (locations: string[], description = "", extra: Partial<Job> = {}): Job => ({
  id: "t",
  source: "test",
  title: "Senior Full Stack Engineer",
  company: "Acme",
  url: "https://example.com",
  locations,
  description,
  postedAt: null,
  ...extra,
});

describe("classifyLocation", () => {
  const cases: [string, string][] = [
    ["Worldwide", "open"],
    ["Anywhere in the World", "open"],
    ["Home based - Worldwide", "open"],
    ["Remote, Global", "open"],
    ["Ethiopia", "open"],
    ["Africa", "open"],
    ["Kenya, Nigeria, Africa", "open"],
    ["South Africa", "restricted"],
    ["Home based - EMEA", "likely"],
    ["Europe, Middle East and Africa", "likely"],
    ["UTC+3", "likely"],
    ["CET ± 3 hours", "likely"],
    ["Remote", "unknown"],
    ["100% Remote", "unknown"],
    ["", "unknown"],
    ["USA", "possible"],
    ["Remote - US", "possible"],
    ["REMOTE (US or Canada)", "possible"],
    ["Anywhere in the US", "possible"],
    ["Remote within Europe", "possible"],
    ["North America Only", "possible"],
    ["Germany, Ireland, Spain, Sweden, UK", "possible"],
    ["India", "restricted"],
    ["LATAM", "restricted"],
    ["Remote, Brazil", "restricted"],
    ["Remote within APAC", "restricted"],
    ["New York", "restricted"],
    ["Hybrid", "restricted"],
    ["Office Based - London, UK", "restricted"],
  ];
  for (const [text, expected] of cases) {
    it(`${JSON.stringify(text)} → ${expected}`, () => {
      assert.equal(classifyLocation(text).status, expected);
    });
  }
});

describe("classifyJob", () => {
  it("takes the most permissive of several locations", () => {
    assert.equal(classifyJob(job(["Home Based - Americas", "Home based - Worldwide"])).status, "open");
  });

  it("lets a description restriction override an open location", () => {
    const result = classifyJob(job(["Anywhere in the World"], "Candidates must be located in the United States."));
    assert.equal(result.status, "restricted");
  });

  it("catches work-authorisation requirements", () => {
    assert.equal(classifyJob(job(["Worldwide"], "You must be authorized to work in the US.")).status, "restricted");
    assert.equal(classifyJob(job(["Remote"], "US-based candidates only")).status, "restricted");
  });

  it("keeps US/Europe-listed jobs only when nothing requires residency, citizenship or US payroll", () => {
    assert.equal(classifyJob(job(["Remote - US"], "Build our React app.")).status, "possible");
    assert.equal(classifyJob(job(["Remote - US"], "Candidates must be located in the US.")).status, "restricted");
    assert.equal(classifyJob(job(["Remote - US"], "US citizenship required.")).status, "restricted");
    assert.equal(classifyJob(job(["Remote - US"], "We offer a 401(k) match.")).status, "restricted");
    assert.equal(classifyJob(job(["Remote - US"], "Medical, dental, and vision insurance.")).status, "restricted");
    // A worldwide posting that also mentions US benefits stays open.
    assert.equal(classifyJob(job(["Worldwide"], "US employees get a 401(k).")).status, "open");
  });

  it("reads a region at the end of the title", () => {
    assert.equal(classifyJob(job(["Remote"], "", { title: "Senior Software Engineer, AI Training - LATAM" })).status, "restricted");
    assert.equal(classifyJob(job(["Remote"], "", { title: "Senior Software Engineer, AI Training - US" })).status, "possible");
    assert.equal(classifyJob(job(["Remote"], "", { title: "Full Stack Engineer (EMEA)" })).status, "likely");
    // A title region never upgrades a stricter location.
    assert.equal(classifyJob(job(["India"], "", { title: "Full Stack Engineer - Global" })).status, "restricted");
  });

  it("upgrades a bare 'Remote' when the description says they hire anywhere", () => {
    assert.equal(classifyJob(job(["Remote"], "We hire globally and pay via Deel.")).status, "open");
    assert.equal(classifyJob(job(["Remote"], "A great team.")).status, "unknown");
  });

  it("trusts a structured source hint unless the description contradicts it", () => {
    assert.equal(classifyJob(job(["United States"], "", { eligibilityHint: "open" })).status, "open");
    assert.equal(
      classifyJob(job([], "This role is only open to candidates in the US.", { eligibilityHint: "open" })).status,
      "restricted",
    );
  });

  it("does not mistake ordinary uses of 'us' for the country", () => {
    assert.equal(classifyJob(job(["Worldwide"], "Join us. Tell us about yourself. Work with us only if you love TypeScript.")).status, "open");
  });
});
