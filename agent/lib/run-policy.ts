/** Limits for this small-task pilot. Time is checked between model calls. */
export const RUN_POLICY = {
  analyst: { calls: 1, minutes: 4, outputTokens: 4000, steps: 16 },
  classifier: { calls: 1, minutes: 1, outputTokens: 500, steps: 4 },
  implementer: { calls: 2, minutes: 8, outputTokens: 10_000, steps: 30 },
  orchestrator: { calls: 1, minutes: 30, outputTokens: 6000, steps: 40 },
  researcher: { calls: 1, minutes: 3, outputTokens: 2000, steps: 10 },
  reviewer: { calls: 2, minutes: 3, outputTokens: 3000, steps: 16 },
} as const;

export type Station = Exclude<keyof typeof RUN_POLICY, "orchestrator">;
export interface RunUsage {
  outputTokens: number;
  startedAt: number;
  steps: number;
}

export function stopReason(
  stage: keyof typeof RUN_POLICY,
  usage: RunUsage,
  now: number
): string | null {
  const policy = RUN_POLICY[stage];
  if (now - usage.startedAt >= policy.minutes * 60_000) {
    return `${stage}: ${policy.minutes}-minute time limit reached`;
  }
  if (usage.outputTokens >= policy.outputTokens) {
    return `${stage}: ${policy.outputTokens}-output-token budget reached`;
  }
  if (usage.steps >= policy.steps) {
    return `${stage}: ${policy.steps}-model-call limit reached`;
  }
  return null;
}

/** Never launch a replacement child to work around an exhausted budget. */
export function dispatchRefusal(
  stage: Station,
  calls: number,
  startedAt: number,
  now: number,
  stopped: boolean
): string | null {
  if (stopped) {
    return "The pipeline has stopped; preserve the draft and hand off to a person.";
  }
  if (now - startedAt >= RUN_POLICY.orchestrator.minutes * 60_000) {
    return "The pipeline time limit has elapsed.";
  }
  if (calls >= RUN_POLICY[stage].calls) {
    return `No ${stage} calls remain; at most one implementation revision is allowed.`;
  }
  return null;
}
