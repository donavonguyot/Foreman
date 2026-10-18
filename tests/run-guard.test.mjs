import "./helpers/load-typescript.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const OUTPUT_STOP = /FOREMAN_STOP.*output-token/;
const TIME_LIMIT = /time limit/;
const CALL_LIMIT = /model-call limit/;
const NO_IMPLEMENTER_CALLS = /No implementer calls/;
const PARALLEL_STATIONS = /one at a time/;
const STOPPED = /pipeline has stopped/;
const DRAFT_FAILED = /Checkpoint draft failed/;
const OUTPUT_BUDGET = /output-token/;

const { runGuard } = await import("../agent/lib/run-guard.ts");

// Isolated Eve context only: no session, model, sandbox, HTTP, or credentials.
// This tests the installed framework's state semantics without invoking a run.
const eveRoot = new URL("../../../../", import.meta.resolve("eve/context"));
const { ContextContainer, contextStorage } = await import(
  new URL("dist/src/context/container.js", eveRoot)
);
const completed = (outputTokens = 0) => ({ data: { usage: { outputTokens } } });
const actions = (...names) => ({
  data: { actions: names.map((toolName) => ({ kind: "tool-call", toolName })) },
});

function inContext(callback) {
  return contextStorage.run(new ContextContainer(), callback);
}

test("real hook blocks the next call after reported output crosses budget", () => {
  inContext(() => {
    const hook = runGuard("implementer").events;
    hook["session.started"]();
    hook["step.started"]();
    hook["step.completed"](completed(10_001));
    assert.throws(() => hook["step.started"](), OUTPUT_STOP);
  });
});

test("real hook applies time and model-call boundaries", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  inContext(() => {
    const hook = runGuard("implementer").events;
    hook["session.started"]();
    t.mock.timers.tick(8 * 60_000);
    assert.throws(() => hook["step.started"](), TIME_LIMIT);
  });
  inContext(() => {
    const hook = runGuard("classifier").events;
    hook["session.started"]();
    for (let index = 0; index < 4; index += 1) {
      hook["step.started"]();
      hook["step.completed"](completed());
    }
    assert.throws(() => hook["step.started"](), CALL_LIMIT);
  });
});

test("root dispatch blocks a second revision and parallel station batches", () => {
  inContext(() => {
    const hook = runGuard("orchestrator").events;
    hook["actions.requested"](actions("run_implementer"));
    hook["actions.requested"](actions("run_implementer"));
    assert.throws(
      () => hook["actions.requested"](actions("run_implementer")),
      NO_IMPLEMENTER_CALLS
    );
  });
  inContext(() => {
    const hook = runGuard("orchestrator").events;
    assert.throws(
      () =>
        hook["actions.requested"](actions("run_analyst", "run_implementer")),
      PARALLEL_STATIONS
    );
  });
});

test("child failure permits a root handoff but forbids more station work", () => {
  inContext(() => {
    const hook = runGuard("orchestrator").events;
    hook["action.result"]({
      data: {
        result: {
          kind: "tool-result",
          output: { stopped: true },
          toolName: "run_implementer",
        },
      },
    });
    hook["step.started"]();
    hook["actions.requested"](actions("github__getPullRequest"));
    assert.throws(
      () => hook["actions.requested"](actions("run_reviewer")),
      STOPPED
    );
  });
});

test("failed checkpoint draft prevents the implementer's next model call", () => {
  inContext(() => {
    const hook = runGuard("implementer").events;
    hook["action.result"]({
      data: {
        result: {
          kind: "tool-result",
          output: { stopped: true, success: true },
          toolName: "push_branch",
        },
      },
    });
    assert.throws(() => hook["step.started"](), DRAFT_FAILED);
  });
});

test("durable usage survives a step context round trip but children are isolated", () => {
  const saved = inContext(() => {
    const hook = runGuard("classifier").events;
    hook["step.completed"](completed(501));
    return [...contextStorage.getStore().entries()];
  });
  const restored = new ContextContainer();
  for (const [key, value] of saved) {
    restored.set(key, structuredClone(value));
  }
  contextStorage.run(restored, () => {
    assert.throws(
      () => runGuard("classifier").events["step.started"](),
      OUTPUT_BUDGET
    );
  });
  inContext(() => runGuard("classifier").events["step.started"]());
});

for (const station of [
  "classifier",
  "researcher",
  "analyst",
  "implementer",
  "reviewer",
]) {
  test(`${station} wrapper hands off failure without calling a replacement child`, async () => {
    const { default: tool } = await import(`../agent/tools/run_${station}.ts`);
    let calls = 0;
    const result = await tool.execute(
      { message: "offline fixture" },
      {
        agent() {
          calls += 1;
          return Promise.reject(new Error("FOREMAN_STOP: offline fixture"));
        },
      }
    );
    assert.equal(calls, 1);
    assert.equal(result.stopped, true);
    assert.equal(result.stage, station);
  });
}
