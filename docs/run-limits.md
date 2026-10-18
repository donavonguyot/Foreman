# Pilot run limits

Foreman works on the personal fork only. The configured baseline is `main`. These limits are for small proof-of-concept tasks; a person decides whether to split larger work or change the policy before another run.

| Stage | Output tokens | Minutes | Model calls | Invocations per session |
| --- | ---: | ---: | ---: | ---: |
| Classifier | 500 | 1 | 4 | 1 |
| Researcher (optional) | 2,000 | 3 | 10 | 1 |
| Analyst | 4,000 | 4 | 16 | 1 |
| Implementer | 10,000 | 8 | 30 | 2 (initial + one revision) |
| Reviewer | 3,000 | 3 | 16 | 2 (initial + one revision) |
| Orchestrator | 6,000 of its own output | 30 overall | 40 of its own calls | 1 |

`agent/lib/run-policy.ts` owns the table. Each agent has a lifecycle hook that checks elapsed time, accumulated provider-reported output, and completed model calls before starting another model call. Hooks use durable session state; messages and process restarts do not reset it. The root additionally rejects excess station dispatches, parallel station batches, and further station dispatch after a stopped or failed station. Workflow wrappers turn child failures into an explicit stopped handoff, never retrying a station. The root-copy agent tool is disabled. Use a new session for a separately authorized work item.

Eve's independent output-token backstop is 45,000 for the root including its children (previously 100,000); each child's backstop is its table budget plus 2,000 tokens. These are limits checked before model calls, not exact ceilings: the call that crosses a token limit can finish and overshoot. Provider reasoning tokens count as reported output. A backstop can still raise Eve's budget approval prompt; do not approve more budget automatically. The smaller hook budgets normally stop first and leave root capacity for a handoff, but large single-call overshoot can reach the backstop first.

## Timing boundary

These are cooperative time limits checked at model-call boundaries, not a wall-clock kill switch. An already delegated station, running model call, sandbox initialization, shell command, network wait, or pending human-input prompt is not forcibly interrupted by the clock. The next model call is refused when the deadline has elapsed. This avoids a timer race that returns while a child keeps working. Eve's `sessionTimeoutMs` is deliberately not used as a runtime timeout: it lets active work settle. Existing sandbox/provider timeouts still apply. Draft API requests have a 15-second request timeout.

## Checkpoint and stop delivery

The implementer must commit and push its first useful change before lengthy verification. `push_branch` validates the fixed `factory/` namespace and protected baseline as before, pushes only to the literal configured repository URL, and finds or creates a draft against `FACTORY_BASE_BRANCH` using the same Connect credential in the application process. It never marks a PR ready, merges, follows redirects with the credential, or writes upstream. Draft creation is already permitted for every caller by the existing draft policy; no approval-bearing tool is added inside the station.

The checkpoint body explicitly says work is incomplete and unapproved, includes the implementer's checkpoint summary and pending checks, and tells the reader to consult the intake thread and trace. Repeated pushes reuse the existing draft without overwriting a person's edits. The root reports the actual review verdict, stop reason, unresolved findings, skipped checks, and next human step; it updates the draft body only when its existing permission allows. Incomplete drafts use `Related to #N`, never a closing claim.

If a later review rejects the work, a budget stops a child, or a person cancels the run, the checkpoint draft already exists. This is preservation rather than a promise that cleanup code can run after cancellation. An abrupt stop may leave only the original checkpoint summary, with newer details in the trace. Changes not yet committed and pushed are not rescued automatically. A run stopped before a useful push cannot produce a meaningful PR. GitHub or credential failures can also prevent a draft: the push result then identifies the preserved branch and the station stops for manual recovery. No empty commit, fabricated PR, hidden retry, or automatic next run is used to conceal this limitation.

## Offline checks

`pnpm validate` runs lint, TypeScript, deterministic tests, and discovery. Tests exercise budget/time boundaries, station invocation limits, actual lifecycle handlers in isolated Eve contexts, and mocked GitHub draft creation, reuse, errors, and races. `pnpm build --skip-sandbox-prewarm` checks workflow compilation without provisioning a sandbox. CI runs these on Node 24 and Node 26. Do not run paid evals, send a task prompt, or start Foreman unless separately requested.
