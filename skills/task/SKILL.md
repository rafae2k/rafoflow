---
name: task
description: Make a small, already-understood change — a label, a column, a filter, a localized fix — that fits in one sentence and a few files with no direction decision. Use when the user asks for a quick change or fix; use the feature skill instead when the direction is still open.
---

# Task

The guarantees live in the `rafoflow` CLI. Run the commands; do not replace them with your own judgment.

1. Start: `rafoflow start <short-slug> --request "<request in one sentence>"`, then work in the worktree path it prints.
2. Classify, from the worktree: `rafoflow classify`. If the tier is `L`, stop and switch to the feature skill.
3. Make the change and the test that covers it.
4. Gate: `rafoflow gate`. Fix until it is green.
5. Review: `rafoflow review`. It runs reviewers from another vendor and fixes until convergence.
6. Report the outcome the CLI printed. If it escalated, show the remaining findings to the user and stop.

If you hit a question you cannot answer from the code: `rafoflow block "<question>"` and stop.
