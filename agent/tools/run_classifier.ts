import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { CLASSIFIER_OUTPUT_SCHEMA } from "../lib/stations/schemas.js";

/**
 * Blocking wrapper the orchestrator calls to run the `classifier` station.
 *
 * @remarks
 * - `defineAgent` has no `outputSchema` anymore; `ctx.agent()` takes one per call.
 * - Named `run_classifier`, not `classifier`: the compiler rejects a tool and a local subagent with the same public name.
 */
export default defineWorkflowTool({
  description:
    "Classify an incoming work item: type (bug/feature/refactor/question/chore/security), " +
    "priority, complexity, affected area, and whether it is actionable or needs " +
    "clarification. Fast triage only; no analysis or implementation. The caller passes " +
    "the work item verbatim in the message.",
  async execute({ message }, ctx) {
    "use workflow";
    try {
      return await ctx.agent("classifier", {
        message,
        outputSchema: CLASSIFIER_OUTPUT_SCHEMA,
      });
    } catch {
      return {
        reason:
          "Station stopped or failed. Do not retry. Preserve any pushed draft, report incomplete checks and unresolved findings, and hand off to a person. Inspect the child trace for the exact stop reason.",
        stage: "classifier",
        stopped: true,
      };
    }
  },
  inputSchema: z.object({
    message: z
      .string()
      .describe(
        "Everything the station needs; it does not see your conversation history."
      ),
  }),
});
