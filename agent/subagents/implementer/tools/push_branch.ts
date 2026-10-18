import { defineTool } from "eve/tools";
import { z } from "zod";
import { FACTORY_BASE_BRANCH, FACTORY_REPO } from "../../../lib/constants.js";
import { ensureCheckpointDraft } from "../../../lib/github/checkpoint-draft.js";
import { githubCredentials } from "../../../lib/github/credentials.js";
import {
  brokerPolicy,
  mintInstallationToken,
  REMOTE_URL,
  REPO_DIR,
  validateBranch,
} from "../../../lib/github/git-remote.js";
import { validatePushTarget } from "../../../lib/github/push-policy.js";
import { environment } from "../sandbox.js";

/**
 * Pushes a committed feature branch of the sandbox checkout to the factory
 * repository.
 *
 * @remarks
 * `validateBranch` checks branch syntax and refuses main/master;
 * `validatePushTarget` restricts writes to factory/ feature branches and
 * refuses the configured baseline even inside that namespace. Both checks
 * run before sandbox or credential access. The credential never enters
 * the sandbox, and the push targets {@link REMOTE_URL} literally, never the
 * model-writable `origin` remote. The `finally` block drops the brokered
 * credential again.
 */
export default defineTool({
  description: `Push a committed factory/ feature branch of the ${REPO_DIR} checkout and ensure it has a draft PR on the configured baseline. Push the first useful checkpoint before lengthy checks or revisions; describe completed and pending checks honestly in summary. Main, master, and the baseline are refused. If draft creation fails, stop and report the pushed branch for manual recovery.`,
  async execute(input, ctx) {
    const refusal =
      validateBranch(input.branch) ??
      validatePushTarget(input.branch, FACTORY_BASE_BRANCH);
    if (refusal) {
      return { error: refusal, success: false as const };
    }
    const sandbox = await ctx.getSandbox(environment);
    const token = await mintInstallationToken(githubCredentials);
    await sandbox.setNetworkPolicy(brokerPolicy(token));
    try {
      const push = await sandbox.run({
        command: `git -C ${REPO_DIR} push ${REMOTE_URL} 'refs/heads/${input.branch}:refs/heads/${input.branch}'`,
      });
      if (push.exitCode !== 0) {
        return {
          error: `git push exited ${push.exitCode}: ${String(
            push.stderr || push.stdout
          ).trim()}`,
          success: false as const,
        };
      }
      const head = await sandbox.run({
        command: `git -C ${REPO_DIR} rev-parse '${input.branch}'`,
      });
      let draft: { number: number; url: string };
      try {
        draft = await ensureCheckpointDraft(
          {
            base: FACTORY_BASE_BRANCH,
            branch: input.branch,
            repo: FACTORY_REPO,
            summary: input.summary,
          },
          token
        );
      } catch {
        return {
          branch: input.branch,
          error:
            "Branch pushed, but its draft PR could not be confirmed. Stop and report this branch for manual recovery; do not continue implementation or review.",
          stopped: true,
          success: true as const,
        };
      }
      return {
        branch: input.branch,
        draft,
        sha: String(head.stdout).trim(),
        success: true as const,
      };
    } finally {
      await sandbox.setNetworkPolicy("allow-all");
    }
  },
  inputSchema: z.object({
    branch: z
      .string()
      .min(1)
      .describe(
        "Branch name in /workspace/repo to push, e.g. factory/bug-dedupe-reset-emails"
      ),
    summary: z
      .string()
      .min(1)
      .max(12_000)
      .describe(
        "Checkpoint summary: what changed, checks run and their results, pending checks, and known limitations. Do not claim review approval."
      ),
  }),
});
