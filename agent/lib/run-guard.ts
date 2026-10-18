import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";
import {
  dispatchRefusal,
  RUN_POLICY,
  type RunUsage,
  type Station,
  stopReason,
} from "./run-policy.js";

/** Each agent session owns its state; it is never shared across children. */
const usage = defineState<RunUsage>("foreman.run-usage", () => ({
  outputTokens: 0,
  startedAt: Date.now(),
  steps: 0,
}));

const dispatch = defineState("foreman.dispatch", () => ({
  calls: {} as Partial<Record<Station, number>>,
  stopped: false,
}));

export function runGuard(stage: keyof typeof RUN_POLICY) {
  return defineHook({
    events: {
      "action.result"(event) {
        const { result } = event.data;
        if (
          result.kind === "tool-result" &&
          (result.toolName.startsWith("run_") ||
            result.toolName === "push_branch") &&
          (result.isError ||
            (typeof result.output === "object" &&
              result.output !== null &&
              "stopped" in result.output &&
              result.output.stopped === true))
        ) {
          dispatch.update((current) => ({ ...current, stopped: true }));
        }
      },
      "actions.requested"(event) {
        if (stage !== "orchestrator") {
          return;
        }
        const stations = event.data.actions.flatMap((action) => {
          if (!("toolName" in action && action.toolName.startsWith("run_"))) {
            return [];
          }
          const name = action.toolName.slice(4);
          return name !== "orchestrator" && Object.hasOwn(RUN_POLICY, name)
            ? [name as Station]
            : [];
        });
        if (stations.length > 1) {
          throw new Error("FOREMAN_STOP: Stations must run one at a time.");
        }
        for (const station of stations) {
          const state = dispatch.get();
          const reason = dispatchRefusal(
            station,
            state.calls[station] ?? 0,
            usage.get().startedAt,
            Date.now(),
            state.stopped
          );
          if (reason) {
            throw new Error(`FOREMAN_STOP: ${reason}`);
          }
          dispatch.update((current) => ({
            ...current,
            calls: {
              ...current.calls,
              [station]: (current.calls[station] ?? 0) + 1,
            },
          }));
        }
      },
      "session.started"() {
        usage.update((current) => current);
      },
      "step.completed"(event) {
        usage.update((current) => ({
          ...current,
          outputTokens:
            current.outputTokens + (event.data.usage?.outputTokens ?? 0),
          steps: current.steps + 1,
        }));
      },
      "step.started"() {
        if (stage !== "orchestrator" && dispatch.get().stopped) {
          throw new Error(
            "FOREMAN_STOP: Checkpoint draft failed; manual recovery required."
          );
        }
        const reason = stopReason(stage, usage.get(), Date.now());
        if (reason) {
          // Eve ends this turn before the next model call. No timer race leaves
          // a child running in the background. Already-pushed work has a draft.
          throw new Error(`FOREMAN_STOP: ${reason}`);
        }
      },
    },
  });
}
