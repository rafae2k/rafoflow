# Bench repos — specification

Three realistic repositories with a known task list, used to test whether rafoflow works: an agent in a normal conversation gets a task, and we score both the **result** (hidden acceptance tests) and the **process** (the rafoflow ledger). The same tasks can run with and without rafoflow, on any harness, to compare.

## Layout of one bench repo

```
bench/<name>/
  README.md                 # for humans: what the repo is, the task table, how to score
  tasks.json                # the task list (schema below)
  repo/                     # the project exactly as the agent sees it; becomes the base commit
    package.json
    tsconfig.json
    AGENTS.md               # domain summary + numbered invariants the code must keep
    README.md
    docs/*.md               # at least 2 docs that reference real code paths and exported symbols
    src/**/*.ts
    test/**/*.test.ts       # all passing at base
  acceptance/<task-id>.test.ts   # hidden from the agent; copied into repo/test/acceptance/ at scoring time
  solutions/<task-id>.patch      # reference solution: `git diff` against the base, applies with `git apply`
```

## Stack constraints (so every repo runs anywhere with no services)

- Node.js 22.18+ only. TypeScript runs through Node's native type stripping: use only erasable syntax (no `enum`, no `namespace`, no constructor parameter properties, no decorators). Imports use the `.ts` extension.
- Built-ins only at runtime: `node:http`, `node:sqlite`, `node:test`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:events`, `node:timers/promises`. No runtime npm dependencies.
- `devDependencies`: only `typescript` (and `@types/node`).
- `package.json` scripts, exactly:
  - `"test": "node --test \"test/**/*.test.ts\""`
  - `"typecheck": "tsc --noEmit"`
- `tsconfig.json`: `strict: true`, `noEmit: true`, `allowImportingTsExtensions: true`, `module`/`moduleResolution`: `nodenext`, `target`: `es2023`, `erasableSyntaxOnly: true` if your TypeScript version supports it, `include: ["src", "test"]`.
- Tests are deterministic: no real clock, no network, no sleeps longer than a few milliseconds. Inject `now` and randomness.
- Code in English. Size: roughly 700–1,500 lines of source, split into realistic modules (not one file). It should feel like a small production codebase: types, a data layer, error handling, some history (a couple of TODOs or small inconsistencies are fine, as in real code).

## Task list (`tasks.json`)

Five tasks per repo, medium to hard. The mix is mandatory:

| Kind | Count | What it tests |
| --- | --- | --- |
| `feature` | 1–2 | A clear new capability; needs tests; touches 3+ files |
| `bugfix` | 1 | A real bug planted in the base code, described by its symptom only (not its location) |
| `risky` | 1 | Expected tier `L`: data migration with backfill, concurrency/ordering, money, or auth. A good process plans first |
| `ambiguous` | 1 | Cannot be done well without a decision the request does not give (two defensible directions, or a missing business rule). A good agent asks or records the open question instead of guessing. No acceptance test |
| `trap` | 1 | The request, done literally, violates an invariant in AGENTS.md. A good agent pushes back or does it in a way that keeps the invariant; the acceptance test checks the invariant still holds |

At least two tasks must change behavior that a doc in `docs/` describes, so the docs phase has something to catch.

```json
[
  {
    "id": "t1-short-slug",
    "kind": "feature | bugfix | risky | ambiguous | trap",
    "title": "Short title",
    "prompt": "Exactly what a user would type to the agent, in plain language, without implementation hints.",
    "expected_tier": "S | M | L",
    "acceptance": "acceptance/t1-short-slug.test.ts or null",
    "expected_process": {
      "plan_approval": true,
      "block_or_ask": false,
      "docs_to_update": ["docs/x.md"],
      "must_keep_invariants": [2, 3]
    },
    "notes": "Why this is hard, what a good solution does, what a bad one does."
  }
]
```

## Acceptance tests

- One file per task with acceptance, importing from `../../src/...` (they will live in `repo/test/acceptance/`).
- They test behavior through the public API of the code, not implementation details, so any correct solution passes.
- **Must fail on the base** and **must pass with the reference solution**.
- For `trap` tasks: test that the invariant holds (and, if a safe version of the feature is possible, that the safe version works).

## Reference solutions

- A patch per task with acceptance, produced with `git diff` from the base commit, that applies cleanly with `git apply` on a fresh base.
- With the patch applied: `npm run typecheck` passes, the base tests pass, and the task's acceptance test passes.
- Solutions include the doc updates the task requires.

## Verification you must run before reporting

On a fresh copy of `repo/` (git init + commit):

1. `npm install`, `npm run typecheck`, `npm test` — all green at base.
2. For each task with acceptance: copy the acceptance file into `test/acceptance/`, confirm it **fails** at base; apply the solution patch, confirm typecheck + all tests (base + that acceptance) **pass**. Reset between tasks.

Report the results as a table: task, acceptance fails at base (yes/no), passes with solution (yes/no).
