# rafoflow v2

A shareable, customizable development process for coding agents — the same process in any repository, across harnesses (Claude Code, Codex, Pi) and model vendors.

> **Status:** v0, working end to end on Claude Code, Codex and Pi. v1 (the `shapeup` Claude Code plugin) lives on `main` and is tagged `v1.0.0`.

## Why v2

Process written as long skills is advisory: the model decides whether to follow it, and adherence drops when you switch models or harnesses. Teams that run agents at scale keep the guarantees in code (orchestrators, gates, CI) and keep the prose short. v1 was prose, and only worked in Claude Code.

v2 moves the guarantees into a small CLI and keeps the skills thin:

- **Base skills** — short `SKILL.md` files (open standard, read by every major harness) that orient the agent and call the CLI for anything that must happen.
- **Base agents** — roles (classifier, researcher, planner, reviewer, fixer, doc gardener) defined as prompt + allowed tools + output schema, executed by the orchestrator in Claude Code, Codex or Pi.
- **Model routing by complexity** — an LLM classifier assigns each piece of work a tier (`S`, `M`, `L`); risk markers declared by the repo are hard floors; a role × tier table picks harness, model and effort; reviewers come from a different vendor than the implementer.
- **Process and verification loops** — phases in code with typed outcomes, a review loop that stops on convergence, gates from the repo's own commands, human checkpoints.
- **Response style** — a router, installed as a managed block in `AGENTS.md`, picks the response type (incident, decision, status, investigation, procedure, explanation, delegation, casual) and applies a short template: answer first, detail after, and warnings, numbers, errors and next steps never cut. Built from ASD-STE100, BLUF, SBAR and SRE postmortems.
- **Measured** — promptfoo eval suites run the real roles on the real harnesses.

## Quick start

```bash
pnpm add -D rafoflow        # or: npm i -D rafoflow (not yet published; for now: pnpm build && node dist/cli.js)
npx rafoflow init --harness claude
# edit .rafoflow/config.yaml: commands, gate, risk_markers
npx rafoflow doctor
```

`init` writes `.rafoflow/config.yaml` and installs the skills into `.agents/skills/` and `.claude/skills/` as tracked copies (each one stamped with the package version, so `doctor` reports drift).

## Commands

| Command | What it guarantees |
| --- | --- |
| `rafoflow start <slug> --request "…"` | A worktree and a `work/<slug>` branch exist before any edit, with a work record |
| `rafoflow classify [--tier S\|M\|L]` | A tier with reasons, never below the repo's risk markers; human override recorded |
| `rafoflow gate` | The repo's declared gate commands, in order |
| `rafoflow review [--yes]` | Reviewers from another vendor + fixer + gate, until zero blocking findings with a green gate; escalates on no progress or after the round ceiling; checkpoint before fixing on configured tiers |
| `rafoflow research "<q>" ["<q>"…]` | Researcher with web access answers with sourced evidence (source levels 1–4) and lists what it could not verify → `research.md` |
| `rafoflow plan` | Planner writes direction, rejected alternatives, steps with files, exit criteria and risks → `plan.md` |
| `rafoflow approve plan` | A human records the approval (agents are told never to run it) |
| `rafoflow docs [--check]` | Finds docs the change made untrue (explicit map, file and symbol mentions); the doc gardener updates or justifies each; verifies nothing was skipped and no code was touched |
| `rafoflow ci` | Writes a GitHub Actions workflow that runs the repo's gate on every PR, with no rafoflow dependency in CI; `doctor` flags it when stale |
| `rafoflow block "<question>" [--kind …]` | The question is recorded as `blocked`, `needs_research` or `needs_poc` and the agent stops |
| `rafoflow status` / `doctor` | Work record; config layers, effective routing, binaries, auth mode, skill and CI drift |

Everything the orchestrator does is appended to `.rafoflow/work/<id>/ledger.jsonl`.

## Repository contract

```yaml
# .rafoflow/config.yaml
extends: ["@acme/rafoflow-preset"] # optional; presets can only tighten guardrails
session_harness: claude # reviewers are routed to the other vendor
commands:
  typecheck: pnpm typecheck
  test: pnpm test
gate: [typecheck, test]
risk_markers:
  - { path: "db/migrations/**", tier: L, reason: migration }
```

## Evals (promptfoo)

```bash
pnpm build
pnpm eval:classifier
pnpm eval:reviewer
node evals/routing/prepare.mjs && pnpm eval:routing
```

First results, 2026-10-03:

| Suite | What | Result |
| --- | --- | --- |
| classifier | 10 labeled requests × Claude Haiku, Codex (low effort) and Pi (OpenAI) | 30/30 after one prompt revision (first run, Claude and Codex only: 16/20 — Haiku under-rated a CSV export, Codex over-rated a payment-status banner and an internal API change, and Haiku once skipped the structured output) |
| reviewer | Seeded-defect fixture (3 defects), 3 repeats × Codex (medium) and Claude Sonnet | 6/6: all 3 defects found in every run; Codex 0 noise, Sonnet 1 minor finding (missing tests) |
| routing | 4 requests (task / feature / research, with near-misses), 2 repeats on Codex | 8/8 |
| style | 10 cases with and without the response-style router, Claude Sonnet and Codex | Router cut prose 19% (Claude) and 16% (Codex); answer-first 8/9 vs 3/9 (Claude) and 7/9 vs 6/9 (Codex); no critical field lost — see [docs/response-style.md](docs/response-style.md) |

An end-to-end run of `rafoflow review` on the fixture converged in 2 rounds (~80 s, US$ 0.34 of Claude): Codex found the 3 defects, Claude fixed them and added tests.

Limits: the labels, the fixture and the prompts were written by the same author; one fixture only; Claude skill routing is not evaluated yet (the Claude Agent SDK provider needs API key auth); research, plan and docs were checked by hand on the fixture, not by an eval suite yet.

## Docs

- [docs/design.md](docs/design.md) — the design.
- [docs/research.md](docs/research.md) — what it is based on, with sources.
- [spike/](spike/) — the review-loop spike that validated the core mechanism.

## License

MIT
