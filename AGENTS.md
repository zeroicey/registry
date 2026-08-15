# AGENTS.md

Guidelines for AI agents working in this repository.

## Repository layout

- Git repo root is this directory. The Bun backend lives in `api/` (its `package.json`, `commitlint.config.js`, and `node_modules`).
- Never stage or commit: `api/.env`, `api/dist/`, `node_modules/`, and local tooling dirs (`.ai`, `.omo`, `.codegraph`). Check `git status` before committing.

## Git commits

- Commits are validated by Husky + commitlint — rules live in `api/commitlint.config.js` (Conventional Commits, lowercase English subject ≤ 72 chars, body required). One-line commits are rejected.
- Write a meaningful body: what changed and why. Don't pad it just to pass the check.

## Project memory (.ai/)

- `.ai/` at the repo root is the project's working memory. Read `.ai/README.md` first (rules + directory responsibilities), then skim the latest `.ai/worklog/` entries before starting work.
- Log real work in `.ai/worklog/YYYY-MM-DD.md` (one file per day, `##` sections per topic) at the end of a session with tangible output.
- Mark pitfalls with `⚠️` in worklog entries. If the same pitfall bites twice, promote it to this file.
- Record decisions (including rejected/deferred ones) in `.ai/decisions.md` — one line each, newest first: date, topic, decision, why.
- Reproducible flows go to `.ai/runbooks/`; the worklog keeps only a one-line pointer.
- Once inbox fragments are digested into their final location, delete them from `.ai/inbox/`.

## Commands

- `cd api && bun install` — install dependencies (also (re)installs git hooks via `prepare`)
- `cd api && bun run dev` — run the dev server; `bun test` — run tests
- `cd api && echo "feat: add pagination" | bunx --no-install commitlint` — lint a message
