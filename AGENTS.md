# AGENTS.md

Guidelines for AI agents working in this repository.

## Repository layout

- Git repo root is this directory. The Bun backend lives in `api/` (its `package.json`, `commitlint.config.js`, and `node_modules`).
- Never stage or commit: `api/.env`, `api/dist/`, `node_modules/`, and local tooling dirs (`.ai`, `.omo`, `.codegraph`). Check `git status` before committing.

## Git commits

- Commits are validated by Husky + commitlint — rules live in `api/commitlint.config.js` (Conventional Commits, lowercase English subject ≤ 72 chars, body required). One-line commits are rejected.
- Write a meaningful body: what changed and why. Don't pad it just to pass the check.

## Commands

- `cd api && bun install` — install dependencies (also (re)installs git hooks via `prepare`)
- `cd api && bun run dev` — run the dev server; `bun test` — run tests
- `cd api && echo "feat: add pagination" | bunx --no-install commitlint` — lint a message
