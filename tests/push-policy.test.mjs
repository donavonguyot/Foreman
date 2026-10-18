import assert from "node:assert/strict";
import test from "node:test";
import { validatePushTarget } from "../agent/lib/github/push-policy.ts";

test("stations cannot push the pilot baseline or human branches", () => {
  for (const branch of [
    "bootstrap/node24-self-hosting",
    "main",
    "master",
    "feature/human-work",
    "factory-lookalike/topic",
    "factory/",
  ]) {
    assert.notEqual(
      validatePushTarget(branch, "bootstrap/node24-self-hosting"),
      null,
      branch
    );
  }
});

test("a configured baseline inside factory/ is still protected", () => {
  assert.notEqual(
    validatePushTarget("factory/baseline", "factory/baseline"),
    null
  );
  assert.equal(validatePushTarget("factory/fix", "factory/baseline"), null);
});

test("feature pushes work before and after switching the baseline to main", () => {
  for (const baseline of ["bootstrap/node24-self-hosting", "main"]) {
    assert.equal(validatePushTarget("factory/fix", baseline), null);
  }
});
