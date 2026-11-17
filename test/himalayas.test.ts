import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMcpSearch, postingDate } from "../src/lib/jobs/sources/himalayas.ts";

// Trimmed from a real search_jobs answer (2026-11-17).
const SEARCH = `Found 52 jobs matching 'product engineer' (showing page 1)


🚀 **Product Engineer**
🏢 SafetyWing ✅

🕘 Full-time • 🌍 Worldwide Remote
📅 Posted 2026-09-05
💵 💰 Competitive salary
🆔 company_slug "safetywing", job_slug "product-engineer-1774480954"

🔗 **Apply on Himalayas:** https://himalayas.app/companies/safetywing/jobs/product-engineer-1774480954?utm_source=mcp

---

🚀 **Senior Full Stack Engineer (.NET/React)**
🏢 Opinov8 

🕘 Full-time • Afghanistan, Albania, Algeria
📅 Posted 2026-11-16
🆔 company_slug "opinov8", job_slug "senior-full-stack-engineer-net-react-ai-services"
`;

const unix = (iso: string) => Date.parse(iso) / 1000;

describe("Himalayas", () => {
  it("reads each job's real posting day from the MCP search", () => {
    const { total, listings } = parseMcpSearch(SEARCH);
    assert.equal(total, 52);
    assert.deepEqual(
      listings.map((l) => [l.guid, l.postedOn.toISOString()]),
      [
        ["https://himalayas.app/companies/safetywing/jobs/product-engineer-1774480954", "2026-09-05T00:00:00.000Z"],
        ["https://himalayas.app/companies/opinov8/jobs/senior-full-stack-engineer-net-react-ai-services", "2026-11-16T00:00:00.000Z"],
      ],
    );
    assert.deepEqual(parseMcpSearch("Unable to search job listings."), { total: null, listings: [] });
  });

  it("uses the posting day, not the date Himalayas last refreshed the job", () => {
    const postedOn = new Date("2026-09-05T00:00:00Z");
    // pubDate was reset to Nov 16 by a re-check.
    assert.equal(postingDate(unix("2026-11-16T17:31:57Z"), postedOn)?.toISOString(), "2026-09-05T00:00:00.000Z");
    // Same day: the REST timestamp is the original time.
    assert.equal(postingDate(unix("2026-09-05T06:47:01Z"), postedOn)?.toISOString(), "2026-09-05T06:47:01.000Z");
    // Not in the MCP search: no date rather than a refresh date.
    assert.equal(postingDate(unix("2026-11-16T17:31:57Z"), undefined), null);
  });
});
