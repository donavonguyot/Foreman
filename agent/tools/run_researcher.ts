import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { RESEARCHER_OUTPUT_SCHEMA } from "../lib/stations/schemas.js";

/**
 * Blocking wrapper the orchestrator calls to run the `researcher` station.
 *
 * @remarks
 * - `defineAgent` has no `outputSchema` anymore; `ctx.agent()` takes one per call.
 * - Named `run_researcher`, not `researcher`: the compiler rejects a tool and a local subagent with the same public name.
 */
export default defineWorkflowTool({
  description:
    "Research a topic on the open web for facts, statistics, primary sources, and links the " +
    "caller doesn't already have. Runs refined searches against reliable sources and returns " +
    "cited findings with confidence levels, plus the gaps it couldn't verify. May save a " +
    "long research memo as an artifact and return its id for later stations. The caller " +
    "passes the question and any known context in the message.",
  async execute({ message }, ctx) {
    "use workflow";
    try {
      return await ctx.agent("researcher", {
        message,
        outputSchema: RESEARCHER_OUTPUT_SCHEMA,
      });
    } catch {
      return {
        reason:
          "Station stopped or failed. Do not retry. Preserve any pushed draft, report incomplete checks and unresolved findings, and hand off to a person. Inspect the child trace for the exact stop reason.",
        stage: "researcher",
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
