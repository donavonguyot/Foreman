/** Push authorization, separate from branch syntax and read-only checkout. */
export function validatePushTarget(
  branch: string,
  baselineBranch: string
): string | null {
  if (branch === baselineBranch) {
    return `Direct pushes to the baseline ${baselineBranch} are not allowed.`;
  }
  if (!branch.startsWith("factory/") || branch === "factory/") {
    return "Station pushes must target a feature branch under factory/.";
  }
  return null;
}
