import assert from "node:assert/strict";
import { it } from "node:test";
import { missingAuthSettings } from "../src/lib/env-check.ts";

it("lists the sign-in settings that are missing or blank", () => {
  assert.deepEqual(missingAuthSettings({ DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: " ", GOOGLE_CLIENT_ID: "id" }), [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_SECRET",
    "ALLOWED_EMAILS",
  ]);
});
