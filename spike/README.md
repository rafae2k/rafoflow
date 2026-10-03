# Spike — a review loop that converges

2026-09-30. Throwaway code kept as the seed for the v2 CLI.

## Question

Does an orchestrator in code close the review loop on its own, and is Shopify's [Roast](https://github.com/Shopify/roast) a better base than a plain TypeScript script?

## The loop (same in both implementations)

1. Reviewer: Codex (`codex exec`, read-only sandbox, output validated against `shared/review-schema.json`) reviews `git diff HEAD`.
2. `blocker` and `major` findings block; `minor` does not.
3. Stop when: zero blocking findings with a green gate (converged); blocking findings did not drop since the last round (no progress → human); 3 rounds (ceiling → human).
4. Optional human checkpoint (`CHECKPOINT=1`) before applying fixes.
5. Fixer: Claude Code (`claude -p`, `acceptEdits`, no Bash) fixes or rebuts each finding.
6. Gate: typecheck plus the tests touched. A gate failure is fed into the next fix.
7. JSONL ledger per step: findings, ids, tokens, cost, fixer verdicts, gate result.

## Scenario

A real commit from a private TypeScript monorepo (a CRM adapter change, 10 files), applied as an uncommitted diff. On the original change the reviewer found **0 issues**. Three known defects were seeded to exercise the loop: a removed configuration guard (sends an undefined id instead of failing loudly), a fabricated date when the real one is unknown, and a deduplication key coarsened from day to month.

## Results

|  | TypeScript | Roast |
| --- | --- | --- |
| Outcome | converged in round 3 | converged in round 3 |
| Seeded defects found | 3 of 3 | 3 of 3 |
| Final code | identical to the original | identical to the original |
| Wall time | 7 min 24 s | 7 min 49 s |
| Nominal Claude cost (2 fixes) | US$ 1.61 | US$ 1.73 |
| Orchestrator lines | 107 | 126 |
| Issues to get it running | none | 2 |

Both followed the same trajectory: round 1 found all three defects but rated the removed guard `minor`; the fixer handled only the two blocking ones; **the gate went red** because an existing test covers that guard; in round 2 the reviewer re-rated the same problem `major` (with a different id) and it was fixed; round 3 was clean.

## Findings

1. **The mechanism works and is cheap to write.** Each stop condition is one line of code, not an instruction to the model.
2. **The gate caught what the reviewer underrated.** Reviewer severity is not stable across rounds. A deterministic gate plus a reviewer is stronger than either alone.
3. **The reviewer found nothing in the real change.** That does not prove it was clean; it shows a reviewer alone does not replace tests.
4. **The fixer wrote no new tests** although the prompt asked for them, and no reviewer flagged it.
5. **Roast brought no measurable advantage** for this flow and cost: Ruby 3.4+ (macOS ships 2.6); a 1.2.0 bug that breaks every command step outside a Bundler project; helper methods defined in the workflow file are not visible inside steps; Codex is not a supported agent provider, so it ran as a plain command.
6. **Human checkpoint mid-flow** works in both.
7. **Auth:** both ran on subscription logins (Claude Code and ChatGPT). See [docs/research.md §8](../docs/research.md#8-authentication-for-automation).

## Limits

- One scenario, one run per side; time and cost vary between runs.
- Defects seeded by the author of the spike.
- Gate output was not persisted; the cause of the red gate was inferred from the existing test, not read from the log.
- The fixer could not run Bash.

## Files

- `review-loop.ts` — the TypeScript orchestrator (generalized: binaries and gate commands come from env vars).
- `shared/` — reviewer and fixer prompts and the review schema, shared by both implementations.
