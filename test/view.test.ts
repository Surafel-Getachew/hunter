import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_FILTERS, filtersToSearch, parseFilters } from "../src/lib/jobs/view.ts";

describe("job filters in the URL", () => {
  it("defaults when the URL is empty or invalid", () => {
    assert.deepEqual(parseFilters({}), DEFAULT_FILTERS);
    assert.deepEqual(parseFilters({ view: "bogus", tiers: "nope", within: "5", sort: "x" }), DEFAULT_FILTERS);
  });

  it("round-trips non-default filters", () => {
    const filters = { ...DEFAULT_FILTERS, view: "saved" as const, query: "react", tiers: ["open" as const], postedWithinHours: 24, source: "Arc", sort: "newest" as const, section: "main" as const };
    const search = filtersToSearch(filters);
    assert.equal(search, "?view=saved&q=react&section=main&tiers=open&within=24&source=Arc&sort=newest");
    assert.deepEqual(parseFilters(Object.fromEntries(new URLSearchParams(search))), filters);
  });

  it("keeps the default URL empty", () => {
    assert.equal(filtersToSearch(DEFAULT_FILTERS), "");
  });
});
