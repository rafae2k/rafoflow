# rafoflow

**An opinionated Shape Up workflow for Claude Code.** An agent fleet + methodology skills that make disciplined product development the path of least resistance — so an LLM shapes before it builds, bets before it commits, tests the seam, and ships without a quality spiral.

## Why this exists

AI coding defaults to vibes: ask, generate, hope. That produces motion, not products — scope creeps, "done" is fuzzy, and the fix for complexity is more complexity. rafoflow encodes a method instead: 37signals' **Shape Up** (fixed time, variable scope), as installable agents and inline skills. The opinions _are_ the product:

- **Fixed time, variable scope.** Appetite is how much a problem is _worth_, not an estimate. Over budget? Cut scope — never stretch time.
- **Constraints > instructions.** Every agent knows what it must _never_ do. That's what makes them reliable instead of eager.
- **Honesty anchors.** Agents say "I don't know" or "this failed" instead of faking success.
- **Ship half a product, not a half-assed product.** The first version should feel too simple. Iterate on what shipped, from real feedback.
- **No silent scope creep.** "We should also…" is a new pitch for later, not this one.

rafoflow is the _method_. Its companion, **[rafoworks](https://github.com/rafae2k/rafoworks)**, is a Cloudflare Workers boilerplate that _enforces_ the method in a project — a deploy gate, docs-lint, and a changelog guard wired into hooks. Install rafoflow to work this way in any repo; start from rafoworks to have it enforced.

## Install

```txt
/plugin marketplace add rafae2k/rafoflow
/plugin install shapeup@rafoflow
/reload-plugins
```

Then run `/shapeup:cycle "your idea"`, or spawn an agent like `shapeup:shaper`. `/shapeup:flow-router` prints the whole decision tree.

> Installed as a plugin, names are namespaced: skills are `/shapeup:shape`, agents show as `shapeup:shaper` in `/agents`.

## The flagship: `/cycle`

One command runs the whole loop, leaving a durable artifact trail and pausing only where a human genuinely decides:

```txt
/cycle "let users export their data as CSV"

goal → research (parallel) → shape → BET ①  → scope → spec → build + tests → SHIP ②  → review
```

- **Two checkpoints, not ten.** You own the two decisions that matter — the bet (direction) and the ship. Everything between runs autonomously.
- **A trail, not a transcript.** Each phase writes `research.md`, `pitch.md`, `spec.md`, `notes.md`, and a changelog fragment under `docs/cycles/NN/`.
- **A cycle, not an arrow.** Any phase can send work back (building reveals complexity → update the spec first). That's the process working, not failing.

Prefer to drive by hand? Skip `/cycle` and call the skills directly.

## The fleet

**Agents** — autonomous workers you spawn; they run in isolated context and come back with results:

| Agent | What it does | Invoke |
| --- | --- | --- |
| `@shaper` | raw idea → shaped pitch with an appetite | `@shaper "offline workout tracking"` |
| `@product-strategist` | build / kill / defer decisions | `@product-strategist "add social features?"` |
| `@engineer` | build a scoped task end-to-end | `@engineer "implement the readiness card"` |
| `@debugger` | find the root cause of a bug | `@debugger "crash when opening detail view"` |
| `@reviewer` | code review before shipping | `@reviewer "review recent changes"` |
| `@researcher` | deep research with citations (Exa) | `@researcher "HRV readiness scoring"` |
| `@closer` | pre-ship checklist + launch copy | `@closer "prepare the release notes"` |
| `@spec-reviewer` | blind, role-based review of a class A/B spec | `@spec-reviewer "production role: spec.md"` |

**Skills** — inline methodology applied in the current conversation:

| Skill | What it does |
| --- | --- |
| `/setup` | make a repo agent-ready: name and comment every env var, wire the env file, write the agent rules and real-data commands |
| `/cycle` | run the whole loop, orchestrated, with artifacts + 2 checkpoints |
| `/task` | small, already-understood change: short plan, code + test, gate, ship |
| `/explore` | research-only spike or feasibility check; ends in an explicit exit |
| `/shape` | turn an idea into a pitch with a fixed appetite |
| `/bet` | evaluate a pitch: build, kill, or reshape |
| `/scope` | break a pitch into 3–5 independent, valuable slices |
| `/cut` | scope-hammer when you're over appetite |
| `/engineer` | senior-engineer coding principles (KISS/YAGNI, seam tests) |
| `/debug` | scientific-method debugging + production investigation |
| `/review` | code review focused on simplicity and blast radius |
| `/ship` | pre-ship checklist + launch copy (fights "one more thing") |
| `/market-research` | evidence-based research method |

Two skills carry battle-tested discipline ported from a production platform: **`/engineer`** (test the seam not just the unit; iterate-until-green; you-own-the-doc) and **`/debug`** (production investigation — query the source of truth, never assume a status's meaning, double-proof "it doesn't exist").

Process discipline lives in `/cycle`'s references and is applied by the skills and agents: **risk class** (A/B/C) deciding how much verification a spec owes; the **learning loop** (every error changes a layer; no anomaly becomes "normal" without a written acceptance); **authority rules** (silence is not approval, a subagent's recommendation is not authorization, a veto is permanent); **evidence discipline** (provenance of proof, lists from counts, partition before you count); a **two-layer output contract**; and **subagent hygiene**. Small changes take the `/task` fast lane, which promotes to `/cycle` the moment direction opens up.

**→ [Skills in practice](docs/skills-in-practice.md)** shows a worked example of every skill and agent — realistic input to realistic output — with `/debug` walked end to end (reproduce → hypotheses → binary search → five-whys → fix → regression test → production query).

## Examples

```txt
/shape offline workout tracking
# → a pitch: the problem, appetite (e.g. "Small: 1 day"), 3–5 solution elements,
#   rabbit holes, and explicit no-gos. Not a task list.

/cycle "export data as CSV"
# → research → ship, pausing at the bet and before shipping, writing docs/cycles/NN/

@debugger "the detail screen crashes when the list is empty"
# → reproduce → hypotheses → binary search → root cause → fix + regression test

/cut
# → over appetite? what to drop, and the 20%-effort version of what stays
```

## Structure

```txt
.claude-plugin/marketplace.json   the rafoflow marketplace manifest
plugins/shapeup/
  .claude-plugin/plugin.json      the shapeup plugin manifest
  agents/*.md                     the 8 autonomous agents
  skills/*/SKILL.md               the 14 inline skills (+ cycle/references/)
```

## Local dev

```txt
claude plugin validate .                 # validate the marketplace + plugin
claude --plugin-dir ./plugins/shapeup    # run against the local plugin
```

`version` is intentionally omitted from `plugin.json`, so each commit counts as a new version. Update a consuming project with `/plugin marketplace update rafoflow` → `/reload-plugins`.

## Notes

- The `@researcher` agent uses the `exa` + `context7` MCP servers, configured at the user level (`~/.claude.json`) so they're available in every project. Without them it loses web search.
- A project can add its own specialist agents in `.claude/agents/` — they live alongside the plugin's and are called the same way. A project agent with the same name overrides the plugin's. Keep project-coupled agents in the project, not here.

## License

MIT © Rafo
