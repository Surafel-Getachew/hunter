// The fetch and import scripts run these modules directly under Node's type
// stripping. Loading them here catches a type imported without `import type`.
import assert from "node:assert/strict";
import { it } from "node:test";

it("loads every module the scripts use", async () => {
  const pipeline = await import("../src/lib/jobs/pipeline.ts");
  const refresh = await import("../src/lib/jobs/refresh.ts");
  await import("../src/lib/jobs/tracking.ts");
  await import("../src/lib/jobs/queries.ts");
  await import("../src/lib/jobs/view.ts");
  await import("../src/db/schema.ts");
  assert.equal(pipeline.sources.length, 13);
  assert.equal(typeof refresh.refreshJobs, "function");
});
