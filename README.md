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

This fork targets `donavonguyot/Foreman` itself. The bootstrap branch is `bootstrap/node24-self-hosting`; the first Node 26 compatibility draft PR targets that branch so its diff excludes bootstrap changes. Neither PR is merged or marked ready automatically.

Use Node 24.22.0 (`.nvmrc` and `.node-version`) and pnpm 12.14.0. The deployment engine remains `24.x`: Vercel Functions supports Node 24.x and 22.x, not 26. Node 26 is additionally verified for local development and CI only — see [docs/node-compatibility.md](docs/node-compatibility.md) for the evidence and the `node-compatibility` workflow that re-checks both runtimes. Linear is disabled: no Linear channel, MCP connection, credential requirement, or bridging skill is loaded.

```bash
pnpm install --frozen-lockfile
vercel link --project foreman --scope artaizen
vercel env pull .env.local --scope artaizen
pnpm validate
pnpm dev
```

The linked Vercel project is `artaizen/foreman`. Its development environment supplies `GITHUB_CONNECTOR=github/foreman`, `FACTORY_REPO=donavonguyot/Foreman`, and `FACTORY_SETUP_COMMAND` from `.env.example`. The GitHub App is installed only on this fork. Connector webhook triggers remain off; start the first issue explicitly through the TUI.

`FACTORY_SETUP_COMMAND` fetches and checks out the bootstrap branch before installing dependencies in each station. `FACTORY_BASE_BRANCH` defaults to `bootstrap/node24-self-hosting` and must match the branch selected by setup. Station pushes are restricted to `factory/` feature branches and explicitly reject that baseline, even if it is inside `factory/`. Once bootstrap is merged, set `FACTORY_BASE_BRANCH=main`, replace setup with `pnpm install --frozen-lockfile`, and base subsequent tasks on the default branch. Update the Vercel Development settings and pull them locally together.

The dev server binds to loopback and disables Eve's bundled self-modification extension. The running baseline therefore delegates code changes to the sandboxed factory stations. Keep candidate runs separate from the baseline, with their own local Workflow data and no webhook ingress. The first compatibility task must not launch another factory pipeline recursively.

Local workflow state stays local. Code execution still uses Vercel Sandbox, GitHub credentials use Vercel Connect, model calls use AI Gateway, and memory/artifacts use Vercel Blob. The public `foreman-memory` store is for this public-code pilot; do not put credentials or private notes into factory memory. No Next.js application or Postgres database is required.

`pnpm validate` checks formatting, types, push-policy tests, and discovered capabilities. `pnpm build` verifies the build. Evals and live runs consume model/sandbox resources; the full-pipeline eval also pushes a real branch. Run the first issue once, then inspect its evidence before repeating it.

## Resources

- [Foreman Docs](https://ask-foreman.dev/docs)
- [Vercel Connect](https://vercel.com/docs/connect)
- [eve Documentation](https://eve.dev/docs/introduction)
- [GitHub Tools eve Extension](https://github-tools.com/frameworks/eve-extension)

## Explore more templates

- [eve Marketing Team](https://vercel.com/templates/eve/eve-marketing-team)
- [eve Personal Agent](https://vercel.com/templates/nuxt/eve-personal-agent)
- [eve Sanity Copilot](https://vercel.com/templates/eve/eve-sanity-copilot)
