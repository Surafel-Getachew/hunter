import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessRelevance } from "../src/lib/jobs/filters/relevance.ts";
import type { Job } from "../src/lib/jobs/types.ts";

const job = (title: string, description: string): Job => ({
  id: "t",
  source: "test",
  title,
  company: "Acme",
  url: "https://example.com",
  locations: ["Worldwide"],
  description,
  postedAt: null,
});

const STACK = "We use React, Next.js, Node.js, TypeScript and Postgres. You'll build LLM features with LangChain.";

describe("assessRelevance", () => {
  it("keeps full-stack and frontend titles on our stack", () => {
    assert.equal(assessRelevance(job("Senior Full-Stack Engineer", STACK)).relevant, true);
    assert.equal(assessRelevance(job("Frontend Developer (React)", "React and TypeScript")).relevant, true);
  });

  it("keeps generic titles only when the description is our stack", () => {
    assert.equal(assessRelevance(job("Software Engineer", STACK)).relevant, true);
    assert.equal(assessRelevance(job("Software Engineer", "We write Go and some JavaScript.")).relevant, false);
  });

  it("drops wrong seniority or wrong kind of role", () => {
    for (const title of ["Junior Full Stack Developer", "Engineering Manager", "Product Designer", "Full Stack Intern"]) {
      assert.equal(assessRelevance(job(title, STACK)).relevant, false, title);
    }
  });

  it("judges postings without a description by title alone", () => {
    assert.equal(assessRelevance(job("Senior Full Stack Engineer", "")).relevant, true);
    assert.equal(assessRelevance(job("Senior Frontend Developer", "")).relevant, true);
    assert.equal(assessRelevance(job("Java Fullstack Software Engineer (Spring Boot / Angular)", "")).relevant, false);
    assert.equal(assessRelevance(job("Staff Software Engineer", "")).relevant, false);
    assert.equal(assessRelevance(job("Senior Full Stack Engineer", "We write Go and Vue.")).relevant, false);
  });

  it("drops off-stack titles unless they also name our stack", () => {
    assert.equal(assessRelevance(job("Senior Java Engineer", STACK)).relevant, false);
    assert.equal(assessRelevance(job(".NET Developer", STACK)).relevant, false);
    assert.equal(assessRelevance(job("iOS Engineer", STACK)).relevant, false);
    assert.equal(assessRelevance(job("Full Stack Engineer (Vue/React)", STACK)).relevant, true);
    assert.equal(assessRelevance(job("Senior Full-Stack Engineer (Django / Next.js)", STACK)).relevant, true);
    assert.equal(assessRelevance(job("Senior .NET Full-stack Developer", STACK)).relevant, false);
    assert.equal(assessRelevance(job("Senior Angular Full-stack Developer", STACK)).relevant, false);
  });

  it("drops unpaid roles", () => {
    assert.equal(assessRelevance(job("AI Full Stack Engineer (Volunteer, unpaid)", STACK)).relevant, false);
    assert.equal(assessRelevance({ ...job("Full Stack Engineer", STACK), employmentType: "Volunteer" }).relevant, false);
  });

  it("does not treat 'javascript' as 'java'", () => {
    assert.equal(assessRelevance(job("JavaScript Engineer", STACK)).relevant, true);
  });

  it("requires a core skill somewhere in the posting", () => {
    assert.equal(assessRelevance(job("Full Stack Engineer", "Python, Django and Postgres.")).relevant, false);
  });

  it("reports matched skills", () => {
    const { matchedSkills } = assessRelevance(job("Full Stack Engineer", STACK));
    assert.deepEqual(matchedSkills, ["react", "next.js", "node", "typescript", "langchain", "llm", "postgres"]);
  });
});
