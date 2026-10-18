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

### Host prerequisite for Node 26: libatomic

The official Node 26 Linux x64 binary links `libatomic.so.1`; the Node 24
binary does not. The Ubuntu 26.04 host used for this evidence did not have
libatomic installed, so Node 26 initially failed to start at all:

```
node: error while loading shared libraries: libatomic.so.1: cannot open
shared object file: No such file or directory
```

The Node 26 evidence below was produced with a non-root, environment-only
workaround — the `libatomic1` package extracted locally and exposed via
`LD_LIBRARY_PATH` (no system install, nothing persisted outside the
extraction directory):

```sh
apt-get download libatomic1   # or fetch the .deb from archive.ubuntu.com
dpkg-deb -x libatomic1_*.deb "$HOME/libatomic1"
export LD_LIBRARY_PATH="$HOME/libatomic1/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
```

Anyone repeating the Node 26 run must ensure `libatomic.so.1` is resolvable
(`ldconfig -p | grep libatomic`), either preinstalled (it usually ships with
the gcc runtime on desktop/server distributions) or via the workaround
above. This is a real Node 26 portability caveat that Node 24 does not
have, so the Node 26 results here are **not** a claim of universal Node 26
compatibility — they are scoped to hosts where libatomic is available.

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

With that prerequisite in place, every command above succeeded on both
runtimes; the only Node 26 failure encountered was the missing-libatomic
startup failure described above, which did not occur under Node 24.

Command notes (pnpm 12): bare `pnpm info` resolves to pnpm's built-in
registry command rather than the `info` package script, so `pnpm run info`
is required; `pnpm build -- --skip-sandbox-prewarm` forwards the literal
`--` to `eve build` and fails, so the flag is passed directly as
`pnpm build --skip-sandbox-prewarm`.

## Repeatable CI coverage

`.github/workflows/node-compatibility.yml` repeats the same sequence on a
Node `24.22.0` / `26` matrix with pnpm 12.14.0 (via `pnpm/action-setup`,
honoring the `packageManager` pin): frozen install, `pnpm check`,
`pnpm typecheck`, push-policy tests (`pnpm test`), discovery (`pnpm run info`), compiled-only build with
`--skip-sandbox-prewarm`, and a bounded (60s) loopback health probe of the
dev server.

The dev-server step starts `pnpm dev` in its own session (`setsid`) and
cleans up on success, probe failure, and timeout via an `EXIT` trap. Plain
PID or process-group kills are insufficient here: eve detaches its
local-server child into its own process group and session, so killing only
the captured pnpm PID leaves descendants running at PPID 1 with the port
still answering. The trap therefore snapshots the full process tree (by
parentage and by session) before signaling, sends `SIGTERM`, waits up to
10s, escalates to `SIGKILL`, and then fails the step if any tree member
survives or if the port still answers. Logs and the health response live in
a `mktemp -d` directory that the trap removes.

### Credential boundary

The compatibility checks require no repository secrets or Foreman service credentials:

- Sources are fetched **anonymously** over HTTPS (`git init` +
  `git fetch`): the repository is public and the job is read-only.
  `actions/checkout` is deliberately not used because it defaults to
  authenticating with `github.token` and persisting that token into the
  local git configuration. The checkout step asserts that nothing
  credential-like (`credential`/`authorization`/`extraheader`) ends up in
  git config and fails otherwise.
- Checkout fetches only `GITHUB_SHA` and verifies that `HEAD` matches it. If the triggering commit is unavailable, the job fails instead of testing a newer branch or PR merge ref.
- The workflow declares `permissions: {}` to request no repository permissions. This does not mean GitHub stops issuing a job token.
- `actions/setup-node@v4` receives an explicit `token: ""`, overriding its default `github.token` input. Node distribution requests therefore use no supplied GitHub token. See the [action's token input](https://github.com/actions/setup-node/blob/v4/action.yml).
- No repository or organization secrets are read, and the checks do not call Vercel Connect, Blob, models, or start real factory tasks.
- GitHub Actions infrastructure, including the pnpm-store cache, can still use its own runtime authentication. These checks do not claim that the runner is a credential-free environment.

The initial workflow passed both matrix jobs in [GitHub Actions](https://github.com/donavonguyot/Foreman/actions/runs/39158198037). That run predates the explicit empty `setup-node` token input; check the PR's checks for validation of the latest revision. The tables above record the original local evidence. If a runner image lacks `libatomic.so.1`, the Node 26 job will fail at startup and the workaround above applies.

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
- Node 26 support claims are limited to the verified local/CI scope above
  and to hosts where `libatomic.so.1` is resolvable (see the host
  prerequisite); nothing here claims universal Node 26 compatibility or
  enables Node 26 deployment.
