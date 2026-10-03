---
name: feature
description: Build something whose direction is still open — two or more defensible approaches, a schema or data change, a resilience invariant, or anything that needs research first. Use when the user describes a problem or asks for a new feature; use the task skill for small, already-understood changes.
---

# Feature

The guarantees live in the `rafoflow` CLI. Run the commands; do not replace them with your own judgment.

1. Start: `rafoflow start <short-slug> --request "<problem in one sentence>"`, then work in the worktree path it prints.
2. Classify, from the worktree: `rafoflow classify`.
3. Research: use the research skill on the open questions. If it ends `blocked` or `needs_poc`, stop and tell the user.
4. Plan: write `.rafoflow/work/<id>/plan.md` with the chosen direction, the alternatives rejected and why, and exit criteria a reviewer can check.
5. Checkpoint: show the plan to the user and wait for an explicit yes. Silence is not approval.
6. Implement with tests. Run `rafoflow gate` until green.
7. If implementation hits a question the research did not answer: `rafoflow block "<question>" --kind needs_research`, go back to step 3, and do not guess.
8. Review: `rafoflow review`. If it escalates, show the remaining findings to the user and stop.
9. Docs: update every file under the docs paths in `.rafoflow/config.yaml` that the change made untrue, or say why none were.
10. Checkpoint: summarize what changed and wait for an explicit yes before anything ships.
