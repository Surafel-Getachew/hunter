import assert from "node:assert/strict";
import { it } from "node:test";
import { isAllowedEmail } from "../src/lib/allowed-emails.ts";

it("lets in only the listed Google accounts", () => {
  const list = " me@example.com , Other@Example.com ";
  assert.equal(isAllowedEmail("me@example.com", list), true);
  assert.equal(isAllowedEmail("ME@example.com", list), true);
  assert.equal(isAllowedEmail("other@example.com", list), true);
  assert.equal(isAllowedEmail("stranger@example.com", list), false);
  assert.equal(isAllowedEmail(null, list), false);
  assert.equal(isAllowedEmail("me@example.com", ""), false, "an empty list lets nobody in");
});
