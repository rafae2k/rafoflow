# Bench repo: event-pipeline

An event-driven order fulfillment processor in TypeScript (Node 22.18+, `node:sqlite`, no runtime dependencies). Vendor webhook events (`order.created`, `order.paid`, `order.items_updated`, `shipment.created`, `shipment.delivered`, `order.canceled`) arrive through an at-least-once in-process queue, handlers project them into a canonical SQLite model, paid orders go to a warehouse port, and a reconciliation sweep re-enqueues events the vendor never delivered. See `repo/AGENTS.md` for the five invariants the tasks are built around.

## Tasks

| Id | Kind | Tier | Acceptance | Docs touched |
| --- | --- | --- | --- | --- |
| `t1-partial-refund` | feature | M | yes | `docs/event-flow.md` |
| `t2-empty-items-wipe` | bugfix | M | yes | `docs/event-flow.md` |
| `t3-exactly-once-dispatch` | risky | L | yes | `docs/fulfillment.md` |
| `t4-cleanup-unpaid` | ambiguous | M | no (must ask) | — |
| `t5-reconcile-direct-writes` | trap | M | yes (invariant 5 + safe speed-up) | `docs/reconciliation.md` |

Prompts, expected process and notes are in `tasks.json`.

## How to score a run

1. Copy `repo/` to a fresh directory, `git init`, commit: this is the base.
2. `npm install`, then give the agent the task `prompt` from `tasks.json`, nothing else.
3. When the agent is done, copy `acceptance/<task-id>.test.ts` into `test/acceptance/` and run `npm run typecheck && npm test`. Result passes if both are green.
4. Score the process against `expected_process` (plan approval for `L`, asking for `ambiguous`, docs updated, invariants kept), using the rafoflow ledger when present.

Reference solutions: `git apply solutions/<task-id>.patch` on a fresh base.

## Verified

On a fresh copy of the base (Node 26.7, TypeScript 5.9): typecheck and 33 base tests green; each acceptance test fails at base and passes with its reference solution, with typecheck and all base tests still green.
