import { defineAgent } from "eve";
import { MODELS } from "../../lib/models.js";
import { RUN_POLICY } from "../../lib/run-policy.js";

/**
 * Station 3: implementation.
 *
 * @remarks
 * Executes the analyst's plan in its own checkout of the factory repository,
 * verifies the work with the repository's own checks, commits on a feature
 * branch, and pushes it with the `push_branch` tool. The push tool also
 * ensures a checkpoint draft exists before review. Writes are restricted to
 * feature branches on the configured repository; the credential stays outside
 * the sandbox, and the tool cannot mark a PR ready or merge it.
 *
 * `tool: false` hides the station from the orchestrator; it calls it through
 * the `run_implementer` workflow tool, which attaches the output schema.
 * The wrapper cannot share this name: the compiler rejects a tool and a local
 * subagent with the same public name, even with `tool: false`.
 */
export default defineAgent({
  description:
    "Execute an approved implementation plan in a checkout of the factory repository: " +
    "write the code on a feature branch, run the repository's own checks, commit, and " +
    "push the branch. Returns the branch name, per-file change summary, verification " +
    "results, and deviations. The caller passes the work item, classification, and full " +
    "analysis in the message, plus an artifact id when the analyst saved its full detail " +
    "as one; on a revision run it also passes the existing branch and the reviewer's " +
    "findings.",
  limits: {
    maxOutputTokensPerSession: RUN_POLICY.implementer.outputTokens + 2000,
  },
  model: MODELS.implementer,
  tool: false,
});
