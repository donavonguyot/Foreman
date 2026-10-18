<img width="100%" alt="eve Software Factory Banner" src=".github/banner.png" />

# Foreman

[![Docs](https://img.shields.io/badge/Documentation-000?style=flat-square&logo=readthedocs&logoColor=FFF&labelColor=000&color=000)](https://ask-foreman.dev/docs)
[![Agent Stack](https://img.shields.io/badge/Agent%20Stack-000?style=flat-square&logo=vercel&logoColor=FFF&labelColor=000&color=000)](https://vercel.com/kb/agent-stack)
[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

Meet **Foreman**, an eve software factory that puts AI agents on every stage of the development loop and keeps people on the judgment calls.

Foreman takes tasks from GitHub, moves each one through four stations, and delivers a reviewed draft pull request on your repository. You review, mark ready, and merge.


## How it works

- **Classifier** triages the task: type, priority, complexity, actionable or not. When the task isn't actionable, Foreman asks the requester instead of building the wrong thing.
- **Analyst** turns it into a plan with acceptance criteria, working from a live checkout of your repository.
- **Implementer** executes the plan in its own sandbox, verifies with your repo's own checks, and pushes a branch.
- **Reviewer** independently judges everything against the real diff, with evidence for each verdict.

Each station is its own agent with its own instructions, sandbox, and tools. The Reviewer sees only the pushed branch, never the Implementer's reasoning. Between runs, Foreman keeps a **factory brain**: notes about your repository that every run starts from. See [the pipeline](https://ask-foreman.dev/docs/pipeline) and [factory memory](https://ask-foreman.dev/docs/memory) for the full picture.

## How work arrives

- **Label an issue `factory`.** The pipeline runs on its own, posts progress as stations complete, and ends with a draft PR linked to the issue.
- **@mention it on an issue or PR.** Mentions from repo owners, members, and collaborators start an interactive session.
- **The dev TUI.** Hand it a task locally. Changes to GitHub wait for your approval.
- **Red CI on a factory PR.** Foreman diagnoses the failure and pushes a fix to its own branches, never yours.
- **Someone opens a pull request.** Foreman posts one orienting comment for reviewers: a summary, not a review.

## Personal pilot

This fork targets `donavonguyot/Foreman` itself. Bootstrap and Node 26 compatibility are merged on this personal fork; the baseline is now `main`. New work stays in draft PRs for human review. Nothing is pushed to the original project.

Use Node 24.22.0 (`.nvmrc` and `.node-version`) and pnpm 12.14.0. The deployment engine remains `24.x`: Vercel Functions supports Node 24.x and 22.x, not 26. Node 26 is additionally verified for local development and CI only — see [docs/node-compatibility.md](docs/node-compatibility.md) for the evidence and the `node-compatibility` workflow that re-checks both runtimes. Linear is disabled: no Linear channel, MCP connection, credential requirement, or bridging skill is loaded.

```bash
pnpm install --frozen-lockfile
vercel link --project foreman --scope artaizen
vercel env pull .env.local --scope artaizen
pnpm validate
pnpm dev
```

The linked Vercel project is `artaizen/foreman`. Its development environment supplies `GITHUB_CONNECTOR=github/foreman`, `FACTORY_REPO=donavonguyot/Foreman`, and `FACTORY_SETUP_COMMAND` from `.env.example`. The GitHub App is installed only on this fork. Connector webhook triggers remain off; new runs require an explicit request.

`FACTORY_SETUP_COMMAND=pnpm install --frozen-lockfile` installs dependencies after each station clones the repository default, `main`. `FACTORY_BASE_BRANCH` defaults to `main` and must stay aligned with that checkout. Station pushes are restricted to `factory/` feature branches and explicitly reject the baseline, even if it is inside `factory/`.

The dev server binds to loopback and disables Eve's bundled self-modification extension. The running baseline therefore delegates code changes to the sandboxed factory stations. Keep candidate runs separate from the baseline, with their own local Workflow data and no webhook ingress. A task must not launch another factory pipeline recursively.

Local workflow state stays local. Code execution still uses Vercel Sandbox, GitHub credentials use Vercel Connect, model calls use AI Gateway, and memory/artifacts use Vercel Blob. The public `foreman-memory` store is for this public-code pilot; do not put credentials or private notes into factory memory. No Next.js application or Postgres database is required.

`pnpm validate` checks formatting, types, deterministic tests, and discovered capabilities. `pnpm build --skip-sandbox-prewarm` verifies compilation without provisioning a sandbox. Evals and live runs consume model/sandbox resources; the full-pipeline eval also pushes a real branch. See [run limits](docs/run-limits.md) for stage budgets, time boundaries, one revision maximum, and checkpoint drafts that preserve pushed work when a run stops. Do not start another run without an explicit request.

## Resources

- [Foreman Docs](https://ask-foreman.dev/docs)
- [Vercel Connect](https://vercel.com/docs/connect)
- [eve Documentation](https://eve.dev/docs/introduction)
- [GitHub Tools eve Extension](https://github-tools.com/frameworks/eve-extension)

## Explore more templates

- [eve Marketing Team](https://vercel.com/templates/eve/eve-marketing-team)
- [eve Personal Agent](https://vercel.com/templates/nuxt/eve-personal-agent)
- [eve Sanity Copilot](https://vercel.com/templates/eve/eve-sanity-copilot)
