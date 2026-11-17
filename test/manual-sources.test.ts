import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDue, MANUAL_SOURCES } from "../src/lib/jobs/manual-sources.ts";

const at = (iso: string) => new Date(iso);

describe("isDue", () => {
  it("is due when never visited", () => {
    assert.equal(isDue("daily", undefined, at("2026-10-15T09:00:00")), true);
    assert.equal(isDue("weekly", undefined, at("2026-10-15T09:00:00")), true);
  });

  it("daily sites are due again the next calendar day", () => {
    assert.equal(isDue("daily", at("2026-10-15T08:00:00").toISOString(), at("2026-10-15T23:00:00")), false);
    assert.equal(isDue("daily", at("2026-10-15T23:00:00").toISOString(), at("2026-10-16T07:00:00")), true);
  });

  it("weekly sites are due seven days after the last visit", () => {
    const visited = at("2026-10-08T10:00:00").toISOString();
    assert.equal(isDue("weekly", visited, at("2026-10-15T09:00:00")), false);
    assert.equal(isDue("weekly", visited, at("2026-10-15T10:00:00")), true);
  });
});

describe("manual sources", () => {
  it("have unique ids and https links", () => {
    const ids = MANUAL_SOURCES.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of MANUAL_SOURCES) assert.match(s.url, /^https:\/\//, s.id);
  });

  it("keep Google searches within the 32 words Google reads", () => {
    for (const s of MANUAL_SOURCES.filter((s) => s.url.startsWith("https://www.google.com/search"))) {
      const query = new URL(s.url).searchParams.get("q")!;
      const words = query.replace(/[()"]/g, " ").split(/\s+/).filter(Boolean);
      assert.ok(words.length <= 32, `${s.id}: ${words.length} words`);
    }
  });
});
