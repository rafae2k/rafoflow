---
name: feature
description: Build something whose direction is still open — two or more defensible approaches, a schema or data change, a resilience invariant, or anything that needs research first. Use when the user describes a problem or asks for a new feature; use the task skill for small, already-understood changes.
---

# Feature

The guarantees live in the `rafoflow` CLI. Run the commands; do not replace them with your own judgment.

1. Start: `rafoflow start <short-slug> --request "<problem in one sentence>"`, then work in the worktree path it prints.
2. Classify, from the worktree: `rafoflow classify`.
3. Research the open questions: `rafoflow research "<question>" ["<question>" ...]`. If it ends `blocked` or `needs_poc`, stop and tell the user.
4. Plan: `rafoflow plan`. Show `.rafoflow/work/<id>/plan.md` to the user.
5. Checkpoint: wait for an explicit yes. Silence is not approval. The user records it with `rafoflow approve plan`; never run that command yourself.
6. Implement following the plan, with tests. Run `rafoflow gate` until green.
7. If implementation hits a question the research did not answer: `rafoflow block "<question>" --kind needs_research`, then go back to step 3. Do not guess.
8. Review: `rafoflow review`. If it escalates, show the remaining findings to the user and stop.
9. Docs: `rafoflow docs`. It finds the docs the change made untrue and updates or justifies each one.
10. Checkpoint: summarize what changed and wait for an explicit yes before anything ships.
