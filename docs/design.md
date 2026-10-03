# rafoflow v2 — v0 design

Draft, 2026-10-03. Based on [research.md](research.md) and the [review-loop spike](../spike/README.md).

## What it is

A package installed into any repository that gives coding agents a reliable development process, identical across Claude Code, Codex and Pi, customizable per organization and per repository.

## Principles

Each one comes from the research.

1. **Guarantees in code, guidance in short prose.** Anything that must always happen (phase order, stop conditions, gates) is done by the CLI. Skills only orient and tell the agent to call the CLI.
2. **One phase = one invocation with fresh context and a short prompt.** No 150-line skills.
3. **File contracts.** Each phase reads and writes artifacts with a schema; the orchestrator validates before moving on.
4. **Typed outcomes.** Every phase ends in `done`, `blocked` (with the question), `needs_research` or `needs_poc`.
5. **The orchestrator writes the ledger**, not the agent.
6. **Thin adapter per harness.** The agent runs in the harness its model was trained for; the package only invokes it.
7. **Repository specifics stay in the repository.** The package never knows about a specific database, cloud or vendor.
8. **Explicit inheritance.** A repository declares what it inherits; nothing arrives silently.
9. **Measure, don't guess.** Process test scenarios run whenever the model or harness changes.

## Pillar 1 — Base skills

`SKILL.md` format, installed into `.agents/skills/` and `.claude/skills/`.

| Skill | Role | Part guaranteed by the CLI |
| --- | --- | --- |
| `research` | Investigate with an authoritative source hierarchy | Sources and their level recorded in the artifact |
| `feature` | Work with an open direction decision | Phases, checkpoints, loops |
| `task` | Small, well-understood change | Gate and review |
| `debug` | Investigate a production problem | Timeline and evidence |
| `review` | Review a change | Loop until convergence |
| `docs` | Keep documentation true | List of affected docs and enforcement |

Rule: no skill exceeds ~40 instructions. Generic disciplines that proved valuable in practice ship as base text: a source hierarchy (official docs and specs first, content farms banned), double proof before claiming something "does not exist" (search the code and query the data), and dry-run discipline for production writes.

## Pillar 2 — Base agents

An agent here is a **role** defined by the package: short prompt + allowed tools + output schema. It is not a harness subagent, because subagents are not portable. The orchestrator executes the role in whichever harness the routing picks.

| Role | Does | Output |
| --- | --- | --- |
| `classifier` | Classifies the work by complexity and risk | tier + reasons |
| `researcher` | Investigates and records sources | findings + sources + open questions |
| `planner` | Turns research into a plan | plan with exit criteria |
| `implementer` | Writes code and tests | diff + typed outcome |
| `reviewer` | Reviews with clean context | findings with severity |
| `fixer` | Fixes or rebuts findings | verdict per finding |
| `doc-gardener` | Updates affected docs | changed doc or justification |

## Pillar 3 — Model routing by complexity

1. The `classifier` role runs on an LLM from v0, with structured output: tier `S` (trivial), `M` (standard) or `L` (complex or risky), plus the reasons. The human can override the tier.
2. Inputs to the classifier: the request, files and areas touched, risk markers declared by the repository (migrations, production writes, payments), diff size, invariants cited by the repository docs.
3. Risk markers are hard floors: a change touching a path marked `L` is never classified below `L`.
4. A role × tier table picks harness, model and reasoning effort. Example:

| Role | S | M | L |
| --- | --- | --- | --- |
| implementer | fast model | standard model | top model, high effort |
| reviewer | 1 reviewer | reviewer from another vendor | 2 reviewers from different vendors |
| researcher | — | standard model | top model |

5. Fixed rules: the reviewer comes from a different vendor than the implementer when available; a cost ceiling per piece of work; fallback when a vendor fails.
6. The classification and its reasons go to the ledger, so routing quality can be audited and tuned.

## Pillar 4 — Process and verification loops

Phase graph, in code:

```
research ⇄ plan → implement ⇄ review → docs → gate → ship
   ↑______________ blocked / needs_research ______________|
```

- **Back to research:** when a phase returns `blocked` or `needs_research`, the orchestrator records the question and stops at a human checkpoint. Automatic re-routing comes only after it is measured.
- **Review that converges:** stop conditions in code — zero blocking findings with a green gate; no progress between rounds; round ceiling with escalation to a human. Reviewer runs in clean context. Validated by the spike.
- **Gate:** the commands the repository declares (test, typecheck, lint, docs lint). A failure is fed into the next fix round.
- **Docs:** a deterministic list of docs linked to the changed files; each one is updated or justified.
- **Human checkpoints:** configurable per tier (for example direction and ship on `L`; ship only on `S`).
- **Worktree:** `start` creates the worktree, branch and work folder. It is a command, not an instruction.

## Layers and customization

`package defaults < organization preset < repository config`, with explicit `extends` (in the style of Renovate presets). Guardrails (gates, mandatory checkpoints) can only be tightened by lower layers, never loosened (in the style of GitHub rulesets).

Repository contract, `.rafoflow/config.yaml`:

```yaml
extends: ["@acme/rafoflow-preset"]
commands:
  test: pnpm test
  typecheck: pnpm -r typecheck
  lint: pnpm lint
  docs_lint: pnpm docs:lint
docs:
  paths: ["docs/", "AGENTS.md"]
risk_markers:
  - { path: "db/migrations/**", tier: L, reason: migration }
routing: {} # overrides of the role × tier table
checkpoints: {} # overrides per tier
```

## Distribution

- npm package with the CLI.
- `init` installs skills and config into the repository as **tracked copies**: every file records the package version it came from.
- `doctor` detects drift between installed files and the package version; `update` merges, in the style of copier.
- An organization preset is a separate (usually private) package that extends the base.

## Execution and authentication

Adapters: `claude -p`, `codex exec`, `pi` in JSON mode. v0 starts with Claude Code and Codex.

Running automated loops on a consumer subscription login is a gray area in Anthropic's terms; OpenAI recommends API keys for Codex automation. The package supports both modes and `doctor` reports which one is in use.

## Measurement

The package ships its own eval suite on [promptfoo](https://www.promptfoo.dev/docs/guides/evaluate-coding-agents/) instead of a bespoke runner. promptfoo already has first-party providers for the Claude Agent SDK, the OpenAI Codex SDK and the OpenCode SDK, skill-routing assertions (`skill-used`, `not-skill-used`), trajectory assertions over traces (commands run, tools used, order), disposable per-test workspaces with the agent's diff exposed to assertions, cost and latency thresholds, and repeated runs (`--repeat`) to measure variance.

What the suite measures, each one as a promptfoo config in `evals/`:

| Suite | Question | How it scores |
| --- | --- | --- |
| `routing` | Does the request trigger the right skill, and not its sibling? | `skill-used` / `not-skill-used` on positive and near-miss prompts |
| `classifier` | Does the classifier give the right tier? | Labeled requests; exact tier match, and never below a risk-marker floor |
| `reviewer` | Does the reviewer find the seeded defects without noise? | Recall and precision against the fixture's known defects (the spike scenario, generalized) |
| `fixer` | Does the fixer fix without breaking? | Workspace diff plus the fixture's gate commands passing |
| `process` | Does the agent follow the process when left alone? | Trajectory: called `rafoflow start` before editing, ran the gate, ran `rafoflow review` before claiming done |

Every suite runs over a harness × model matrix (Claude Agent SDK, Codex SDK, and Pi through a custom provider), with `--repeat 3`. It runs on every change to a skill, a role prompt or the routing table, and on every model or harness change. Results feed the routing table: a model that loses on a suite does not get that role.

Fixtures are small repositories with known defects and gate commands, kept in `evals/fixtures/`. Organization presets and repositories can add their own fixtures.

Caveats: the Claude Agent SDK provider calls the Agent SDK, which Anthropic says should use API key authentication; the Codex SDK provider works with a Codex login or an API key. Pi has no first-party promptfoo provider; it needs a custom script provider (not yet verified).

## v0 scope

In:

- CLI with `init`, `classify`, `start`, `review`, `gate`, and the ledger.
- promptfoo eval suites `classifier`, `reviewer` and `routing`, over Claude and Codex, with the spike scenario as the first fixture.
- LLM classifier with risk-marker floors and human override.
- Routing table per role × tier.
- Claude Code and Codex adapters.
- Minimal `research`, `task` and `feature` skills.
- Repository contract.
- First real user: a private TypeScript monorepo already running a prose version of this process.

Done after v0: docs phase (`rafoflow docs`), Pi adapter, researcher and planner roles (`rafoflow research`, `rafoflow plan`), CI gate workflow (`rafoflow ci`).

Later: `fixer` and `process` eval suites, eval suites for research/plan/docs, published npm package, `update` command.

## Open decisions

1. Default auth mode for automated loops (subscription or API key).
