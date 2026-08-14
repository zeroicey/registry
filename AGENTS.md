# AGENTS.md

Guidelines for AI agents working in this repository.

## Repository layout

- Git repo root is this directory. The Bun backend lives in `api/` (its `package.json`, `commitlint.config.js`, and `node_modules`).
- Never stage or commit: `api/.env`, `api/dist/`, `node_modules/`, and local tooling dirs (`.ai`, `.omo`, `.codegraph`). Check `git status` before committing.

## Git commits

- Every commit is validated by Husky + commitlint (Conventional Commits): subject is `type: lowercase english summary` (≤ 72 chars); types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Always add a detailed body after a blank line — what changed and why, in English. One-line commits are rejected.
- Example:

  ```
  feat: add user pagination

  add offset/limit params to the list endpoint and expose next/prev
  cursors to keep responses small for large registries.
  ```

## Commands

- `cd api && bun install` — install dependencies (also (re)installs git hooks via `prepare`)
- `cd api && bun run dev` — run the dev server; `bun test` — run tests
- `cd api && echo "feat: add pagination" | bunx --no-install commitlint` — lint a message
