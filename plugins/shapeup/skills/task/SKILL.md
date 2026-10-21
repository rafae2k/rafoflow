---
name: task
description: "Small, already-understood change (new column, ordering, label, filter, localized fix). Use when scope fits one sentence and a few files, with no direction decision. Short plan in chat, code + test, gate, ship. No research/pitch/spec, no cycle folder."
argument-hint: "[the change, in one sentence]"
---

# Task: Small Change, Short Process

A single heavy process turns every small change into bureaucracy — or tempts the agent to skip steps on its own. So there are two lanes: `/cycle` for a problem with open direction, `/task` for a change that is already understood. A task is not a cycle with fewer steps: it cuts the _shaping paperwork_ (research, pitch, spec, numbered folder), never the _proof_.

```
locate → 4-line plan in chat → code + test → gate → ONE checkpoint (ship) → record + verify in the real system
```

## Is this a task? All must hold

- The scope fits in one sentence.
- You know where the code lives — or can find it in ~10 minutes.
- There is only one defensible way to do it.
- It touches about 3 production files and adds no new primitive.
- It is provable with a local test plus one check in the real system afterward.

## Promote to `/cycle` when ANY of these appears

- Two or more defensible architectural options.
- It touches an invariant (ordering, idempotency, a boundary between components).
- You need to measure production to decide the design.
- A schema change with a backfill.
- The scope outgrows the plan.

Stop, say in one sentence why, and offer `/cycle`. Promoting is the process working, not failing. Never keep improvising with "just one more file".

## Process

1. **Locate** — read the code that will change and its neighbors. Match existing patterns.
2. **Plan, 4 lines in chat** — what changes, in which files, which test proves it, how you'll verify it afterward.
3. **Code + test** — tests alongside the code. A bug fix gets a regression test that fails before the fix and passes after.
4. **Gate** — run the project gate and iterate until green (see `/engineer`).
5. **Checkpoint — ship.** One explicit approval, then ship (see `/ship`).
6. **Record + verify** — changelog line, and one check in the real system that the change actually happened.

## What a task does NOT cut

Tests, the gate, the changelog line, verification in production. A task that skips these is just an unreviewed change.

## One code stream per checkout

Two streams editing the same working tree mix their diffs, and the gate runs against the whole tree. One code-editing stream per checkout; real parallelism uses a worktree. Numbering a cycle is a claim on that stream — an idea with no code lives in the backlog, not in a numbered cycle.
