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
6. Docs: `rafoflow docs`. It updates or justifies every doc that references what changed.
7. Report the outcome the CLI printed. If it escalated, show the remaining findings to the user and stop.

If you hit a question you cannot answer from the code: `rafoflow block "<question>"` and stop.

## Rules that hold in every step

- Fix the cause, never the check. Do not edit the gate, the hook settings or a lint, test or complexity config to make something pass, and do not use `--dry-run` to "pass" a deploy. A guard hook denies it; a human unlocks it with `rafoflow approve protected`.
- Work only inside the worktree. After `start`, an absolute path to the main checkout is a mistake: write the file under the worktree path instead. Ship and merge only from the main checkout.
- A production write (database update or delete, a call that changes a vendor system) is never run by you. First run a read-only query that shows the exact rows it would change. Check what each value means before building the statement (per unit or total, local or UTC). Hand the human the statement, ready to paste, together with a query that confirms the result. Do not add an HTTP route to fix one incident: improve the generic safety net, or give a one-off script or statement.

## Known harness quirks

Some harnesses refuse shell commands that `cd` or `git -C` into another checkout, set variables inline with `export` or `source`, or use heredocs and loops. Verify this in your harness; if it applies, call binaries by absolute path, run one literal command per call, and create files with the file-write tool instead of a heredoc.
