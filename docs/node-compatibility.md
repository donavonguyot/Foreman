# Node compatibility evidence

Recorded: 2026-10-18.

This document records the evidence behind Foreman's Node runtime support:
Node 24 is the supported baseline for local development and the only
supported deployment runtime; Node 26 is additionally verified for local
development and CI. No deployment setting was changed.

## Runtime scopes

These three scopes are distinct and must not be conflated:

1. **Local development runtime** — the Node process running `pnpm dev` /
   `pnpm build` on a developer machine or in CI. Verified below on Node
   24.22.0 and Node 26.12.0.
2. **Deployed runtime (Vercel Functions)** — Vercel Functions supports
   Node 24.x (default for new projects) and 22.x; Node 26 is **not** a
   supported Function runtime. `package.json#engines.node` (`24.x`)
   controls/overrides the version Vercel selects, so it stays at `24.x`.
   Sources: [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
   [Configuring functions: runtime](https://vercel.com/docs/functions/configuring-functions/runtime).
3. **Station sandbox (Vercel Sandbox via Eve)** — code execution for
   factory stations runs in an isolated, provider-selected sandbox that is
   separate from the app runtime. The exact Node version inside the sandbox
   is provider-selected and **unverified** here; nothing in this change
   exercises or depends on it.
   Sources: [Eve security model](https://eve.dev/docs/concepts/security-model),
   [Eve sandbox](https://eve.dev/docs/sandbox),
   [Eve default sandbox](https://eve.dev/docs/sandbox/default).

Release-line context (as of 2026-10-18): Node 26 is Current and is
scheduled to become LTS on 2026-10-28; Node 24 is LTS and moves to
Maintenance on 2026-10-20
([Node.js previous releases](https://nodejs.org/en/about/previous-releases/),
[release schedule](https://github.com/nodejs/Release/blob/main/schedule.json)).

## Verified evidence

Both runs executed from a clean checkout of `bootstrap/node24-self-hosting`
(commit `9e11e4d`), on Linux x64 (Ubuntu 26.04), each with its own Node
toolchain and a fresh `node_modules` (`rm -rf node_modules .eve .output`
between runs). pnpm 12.14.0 was provided by Corepack under Node 24 and by
`npm install -g pnpm@12.14.0` under Node 26, because Node 26 no longer
ships Corepack.

`FACTORY_REPO=foreman-ci/compatibility` is a harmless placeholder so that
static discovery and compile have a repository value; no credentials,
Vercel Connect, Blob, model calls, GitHub tasks, evals, webhook intake, or
sandbox work were involved in any step.

### Node 24.22.0 (baseline)

| Command | Result |
| --- | --- |
| `node --version` | `v24.22.0` |
| `pnpm --version` | `12.14.0` |
| `pnpm install --frozen-lockfile` | exit 0 — `Done in 117ms using pnpm v12.14.0` |
| `pnpm check` | exit 0 — `Checked 74 files in 89ms. No fixes applied.` |
| `pnpm typecheck` | exit 0 — `tsc` clean |
| `FACTORY_REPO=foreman-ci/compatibility pnpm run info` | exit 0 — eve v0.67.2, `Compile ready`, `Diagnostics 0 errors, 0 warnings`, 2 skills / 20 tools / 5 subagents |
| `FACTORY_REPO=foreman-ci/compatibility pnpm build --skip-sandbox-prewarm` | exit 0 — `[BUILD] built output at .output`, Σ 12.2 MB (2.73 MB gzip) |
| `FACTORY_REPO=foreman-ci/compatibility pnpm dev --no-ui --port 4824` + loopback poll of `GET /eve/v1/health` | HTTP 200 after 6s — `{"ok":true,"status":"ready","workflowId":"workflow//eve//workflowEntry"}`; process killed after the probe |

### Node 26.12.0

| Command | Result |
| --- | --- |
| `node --version` | `v26.12.0` |
| `pnpm --version` | `12.14.0` |
| `pnpm install --frozen-lockfile` | exit 0 — `Done in 126ms using pnpm v12.14.0` |
| `pnpm check` | exit 0 — `Checked 74 files in 109ms. No fixes applied.` |
| `pnpm typecheck` | exit 0 — `tsc` clean |
| `FACTORY_REPO=foreman-ci/compatibility pnpm run info` | exit 0 — eve v0.67.2, `Compile ready`, `Diagnostics 0 errors, 0 warnings` |
| `FACTORY_REPO=foreman-ci/compatibility pnpm build --skip-sandbox-prewarm` | exit 0 — `[BUILD] built output at .output`, Σ 12.2 MB (2.73 MB gzip) |
| `FACTORY_REPO=foreman-ci/compatibility pnpm dev --no-ui --port 4826` + loopback poll of `GET /eve/v1/health` | HTTP 200 after 6s — `{"ok":true,"status":"ready","workflowId":"workflow//eve//workflowEntry"}`; process killed after the probe |

No failures were observed on either runtime.

Command notes (pnpm 12): bare `pnpm info` resolves to pnpm's built-in
registry command rather than the `info` package script, so `pnpm run info`
is required; `pnpm build -- --skip-sandbox-prewarm` forwards the literal
`--` to `eve build` and fails, so the flag is passed directly as
`pnpm build --skip-sandbox-prewarm`.

## Repeatable CI coverage

`.github/workflows/node-compatibility.yml` repeats the same sequence on a
Node `24.22.0` / `26` matrix with pnpm 12.14.0 (via `pnpm/action-setup`,
honoring the `packageManager` pin): frozen install, `pnpm check`,
`pnpm typecheck`, discovery (`pnpm run info`), compiled-only build with
`--skip-sandbox-prewarm`, and a bounded (60s) loopback health probe of the
dev server with cleanup. The workflow is credential-free and read-only.

## Coverage classification and limitations

- **Compiled-only:** `pnpm run info` and `pnpm build --skip-sandbox-prewarm`
  validate discovery/compile and the build output, not deployability; the
  sandbox prewarm step is deliberately skipped.
- **App startup health only:** the `/eve/v1/health` probe validates that
  the dev server boots and reports ready. No prompt, session, station
  task, eval, or sandbox execution was run.
- **Sandbox-backed validation: not performed.** The Vercel Sandbox Node
  version is provider-selected and unverified; credentialed station
  execution was unavailable and out of scope for this change.
- **Deployed-runtime validation: not performed.** Deployment selectors
  (`engines.node: 24.x`, `.nvmrc`/`.node-version` at 24.22.0) are
  unchanged. Any dashboard-level Vercel Node setting on the linked project
  was not inspected here and remains unverified.
- Node 26 support claims are limited to the verified local/CI scope above;
  nothing here claims or enables Node 26 deployment.
