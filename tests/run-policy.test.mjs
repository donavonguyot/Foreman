import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchRefusal,
  RUN_POLICY,
  stopReason,
} from "../agent/lib/run-policy.ts";

const TIME_LIMIT = /time limit/;
const TOKEN_BUDGET = /token budget/;
const CALL_LIMIT = /model-call limit/;
const NO_CALLS = /No .* calls remain/;
const STOPPED = /pipeline has stopped/;

for (const [stage, policy] of Object.entries(RUN_POLICY)) {
  test(`${stage} stops at each boundary, allowing work below it`, () => {
    const startedAt = 1000;
    const usage = { outputTokens: 0, startedAt, steps: 0 };
    assert.equal(stopReason(stage, usage, startedAt), null);
    assert.equal(
      stopReason(stage, usage, startedAt + policy.minutes * 60_000 - 1),
      null
    );
    assert.match(
      stopReason(stage, usage, startedAt + policy.minutes * 60_000),
      TIME_LIMIT
    );
    assert.match(
      stopReason(
        stage,
        { ...usage, outputTokens: policy.outputTokens },
        startedAt
      ),
      TOKEN_BUDGET
    );
    assert.match(
      stopReason(stage, { ...usage, steps: policy.steps }, startedAt),
      CALL_LIMIT
    );
  });
}

test("a single revision is allowed; retries and later stations after a stop are refused", () => {
  for (const stage of ["implementer", "reviewer"]) {
    assert.equal(dispatchRefusal(stage, 1, 0, 1, false), null);
    assert.match(dispatchRefusal(stage, 2, 0, 1, false), NO_CALLS);
  }
  for (const stage of ["classifier", "researcher", "analyst"]) {
    assert.match(dispatchRefusal(stage, 1, 0, 1, false), NO_CALLS);
  }
  assert.match(dispatchRefusal("reviewer", 0, 0, 1, true), STOPPED);
  assert.match(
    dispatchRefusal("implementer", 0, 0, 30 * 60_000, false),
    TIME_LIMIT
  );
});
