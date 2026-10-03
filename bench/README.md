# Bench — does rafoflow work in practice?

Three realistic repositories with known tasks. An agent gets a task in a normal conversation; afterwards a script scores the **result** (hidden acceptance tests, typecheck, the repo's own tests, docs updated, tests added) and the **process** (what the rafoflow ledger says the agent actually ran).

The same task can run with rafoflow or without it (baseline), and on Claude Code, Codex or Pi. That gives the comparison that matters: does the process make the result better, on every harness?

| Repo | What it is | Stresses |
| --- | --- | --- |
| [subscriptions-api](subscriptions-api/) | Subscription billing HTTP API (`node:http`, `node:sqlite`) | Money in cents, idempotency, domain events, date edge cases |
| [event-pipeline](event-pipeline/) | Event-driven order fulfillment processor | Out-of-order and duplicate events, exactly-once dispatch, reconciliation |
| [site-generator](site-generator/) | Static docs-site generator (library + CLI) | Escaping and path safety, determinism, incremental builds |

Each repo has five tasks: one or two features, a bug described only by its symptom, a risky change (tier L), an ambiguous request (the right move is to ask), and a trap (done literally, it breaks an invariant). See each repo's README and `tasks.json`; the rules are in [SPEC.md](SPEC.md).

## Run one task

```bash
cd ~/code/projects/rafoflow && pnpm build      # once

# 1. fresh copy, with rafoflow (or --variant baseline)
node bench/setup.mjs subscriptions-api /tmp/bench/subs-t1 --harness claude

# 2. open the agent in that folder and paste the task prompt printed by setup
cd /tmp/bench/subs-t1 && claude                # or: codex, pi

#    answer the agent as a user would: approve a sensible plan with
#    `rafoflow approve plan`, answer questions, say "go ahead" when asked

# 3. score
node ~/code/projects/rafoflow/bench/score.mjs subscriptions-api /tmp/bench/subs-t1 t1-<id>
```

Use a new folder for every run. Results are also saved as JSON in `<dest>/.bench-results/`.

## Reading the score

- **Result:** `acceptance` is the hidden test for the task; `typecheck` and `tests` are the repo's own checks; `docs_updated` and `tests_added` check what a good change also touches.
- **Process** (rafoflow runs only):
  - Did the agent work in a worktree?
  - Did it classify, at the expected tier?
  - Did it plan, for an L task, and did a human approve?
  - Was the last gate green, and did review converge?
  - Did docs pass verification?
  - For the ambiguous task, did it record the question?
- **Ambiguous tasks** have no acceptance test: success is the agent asking or recording the open question instead of guessing. The ledger only sees `rafoflow block`; a question asked in chat needs a look at the transcript.
- **Trap tasks** pass when the invariant still holds, whatever the agent did.

## Suggested protocol

For a fair comparison, run each task at least twice per cell:

|          | Claude Code | Codex | Pi  |
| -------- | ----------- | ----- | --- |
| baseline |             |       |     |
| rafoflow |             |       |     |

Keep your answers to the agent the same across runs. Record the scores and any transcript notes (did it push back on the trap, did it ask on the ambiguous task).

## Limits

- Tasks, acceptance tests and solutions were written by AI agents and checked by script (each acceptance test fails on the base and passes with the reference solution). A human review of the tasks is still worth doing.
- One run per cell is noisy; agents are not deterministic.
