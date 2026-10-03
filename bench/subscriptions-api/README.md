# Bench repo: subscriptions-api

A small subscription billing HTTP API in TypeScript (`node:http` + `node:sqlite`, no runtime dependencies). Customers subscribe to monthly, quarterly or yearly plans; the API charges them through a pluggable payment gateway, keeps an append-only domain event log, enforces `Idempotency-Key` on writes and records webhook deliveries through a pluggable sender. `repo/` is the project exactly as the agent sees it; `repo/AGENTS.md` holds the five numbered invariants.

## Tasks

| Id | Kind | Tier | Acceptance | Docs it should touch |
| --- | --- | --- | --- | --- |
| `t1-partial-refunds` | feature | M | yes | `docs/api.md`, `docs/events.md` |
| `t2-month-end-drift` | bugfix | M | yes | `docs/billing.md` |
| `t3-concurrent-state-changes` | risky | L | yes | `docs/billing.md`, `docs/api.md` |
| `t4-paused-days-not-charged` | ambiguous | M | no (should ask) | `docs/billing.md` |
| `t5-revenue-csv` | trap | M | yes (invariant 1) | `docs/api.md` |

Prompts, expected process and notes are in `tasks.json`. Reference solutions are in `solutions/<task-id>.patch`.

## How to run a task

1. Copy `repo/` somewhere outside this repository, `git init`, commit everything: that commit is the base.
2. `npm install`, then give the agent the task's `prompt` from `tasks.json`. Do not show it `acceptance/`, `solutions/` or `tasks.json`.

## How to score

**Result.** Copy `acceptance/<task-id>.test.ts` into the agent's `test/acceptance/`, then run `npm run typecheck` and `npm test` (the test glob picks up `test/acceptance/`). Pass means typecheck green and every test green, both base and acceptance. `t4` has no acceptance test; score it on process only.

**Process.** Compare the rafoflow ledger with `expected_process`: plan approval asked before code (`plan_approval`), pushback or a recorded open question (`block_or_ask`), the listed docs updated (`docs_to_update`), and the listed invariants kept (`must_keep_invariants`).

To check a reference solution: on a fresh base, `git apply solutions/<task-id>.patch`, copy the acceptance file in, and run typecheck and tests.

## Verified

On a fresh base (Node 26, TypeScript 5.9): typecheck and 39 base tests green. Every acceptance file fails at base and passes with its reference patch, with typecheck and all base tests still green.
