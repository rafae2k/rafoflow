---
name: flow-router
description: "Decision tree for the Shape Up workflow — picks which agent or skill to use for a given situation (have an idea, should we build it, build it, something's broken, ready to ship). Use when unsure which part of the shapeup workflow applies, or to see the full cycle from pitch to ship."
---

# Shape Up Flow Router

A 37signals-inspired team of autonomous agents and inline skills for building products with discipline.

**Philosophy:** Fixed time, variable scope. Build half a product, not a half-assed product. Ship, then iterate.

---

## Agents (autonomous workers — spawn them, they come back with results)

| Agent | What it does | Invoke |
| --- | --- | --- |
| `@shaper` | Raw idea → shaped pitch with appetite | `@shaper "offline workout tracking"` |
| `@product-strategist` | Build/kill/defer decisions | `@product-strategist "should we add social features?"` |
| `@engineer` | Build a scoped task end-to-end | `@engineer "implement the readiness card"` |
| `@debugger` | Find root cause of bugs | `@debugger "crash when opening detail view"` |
| `@reviewer` | Code review before shipping | `@reviewer "review recent changes"` |
| `@researcher` | Deep research with Exa search | `@researcher "HRV-based readiness scoring evidence"` |
| `@closer` | Pre-ship checklist, launch copy | `@closer "prepare the release notes"` |

## Skills (inline methodology — slash commands in the current conversation)

| Skill | What it does | Invoke |
| --- | --- | --- |
| `/cycle` | Run the whole loop, orchestrated — artifacts + 2 checkpoints | `/cycle "add offline sync"` |
| `/shape` | Shape an idea into a pitch | `/shape offline workout tracking` |
| `/bet` | Evaluate a pitch: build, kill, reshape | `/bet` (after a pitch) |
| `/scope` | Break a pitch into buildable scopes | `/scope` (after betting) |
| `/cut` | Scope-hammer when over budget | `/cut` |
| `/review` | Code review checklist | `/review` |
| `/ship` | Pre-ship checklist + launch copy | `/ship` |
| `/engineer` | Senior engineer coding principles | `/engineer` |
| `/debug` | Systematic debugging method | `/debug` |
| `/market-research` | Evidence-based research method | `/market-research` |

> When invoked from a plugin, names are namespaced: `/shapeup:shape`, agent shows as `shapeup:shaper` in `/agents`.

---

## When to Use What

### Agent vs Skill

| Use an **agent** when... | Use a **skill** when... |
| --- | --- |
| You want autonomous work in isolated context | You want methodology applied in this conversation |
| The task needs multi-step research or building | You need a checklist or output template |
| You want it running in the background | You want to guide the work step by step |
| The output would bloat your main conversation | The output is short and immediately useful |

### Decision Tree

```
"I have an idea"
  → @shaper (autonomous pitch) or /shape (guided shaping)

"Should we build this?"
  → @product-strategist (autonomous evaluation) or /bet (quick decision)

"Build this feature"
  → @engineer (autonomous implementation)

"Something is broken"
  → @debugger (root cause analysis)

"Is this code ready to ship?"
  → @reviewer (autonomous review) or /review (inline checklist)

"I need research/data"
  → @researcher (deep Exa search with citations)

"I'm over budget"
  → /cut (scope-hammer in current conversation)

"Ready to release"
  → @closer (checklist + launch copy)

"Just run the whole thing for me"
  → /cycle (orchestrates research → ship, pausing only at the bet and the ship)
```

---

## The Workflow

### Full cycle (new feature)

```
1. @shaper        → shaped pitch
2. /bet           → build, kill, or reshape
3. /scope         → 3-5 independent scopes
4. @engineer      → build scope by scope
5. @reviewer      → code review
6. /ship          → pre-ship checklist
7. @closer        → launch / release copy
```

> `/cycle` runs this entire sequence for you — with a persistent artifact trail (`docs/cycles/NN/`) and exactly two human pauses (the bet, the ship). Use the steps above when you want to drive each one by hand; use `/cycle` when you want it orchestrated.

### Quick fix

```
1. @debugger      → find root cause
2. @engineer      → implement fix
3. @reviewer      → verify
```

### Research before deciding

```
1. @researcher          → evidence-based brief
2. @product-strategist  → build/kill decision
```

---

## Project-specific specialists (optional)

This plugin ships only the **generic** fleet. A project can add its own specialist agents in `.claude/agents/` (e.g. a `designer`, `ux-writer`, or domain expert) — they live alongside the plugin agents and you call them the same way. Keep project-coupled agents (ones that read `docs/VISION.md`, use a specific language/platform, etc.) in the project, not in this plugin.

---

## Principles Across All Agents

1. **Constraints > instructions.** Every agent knows what it must NEVER do.
2. **Honesty anchors.** Every agent will say "I don't know" or "this failed" instead of fabricating success.
3. **Circuit breakers.** Agents stop and escalate when stuck, not spin forever.
4. **Read before acting.** Every agent reads existing code/docs before proposing changes.
5. **No orchestrator — with one opt-in exception.** By default you are the decision-maker and agents are specialists you call on. When you want the whole loop driven for you, `/cycle` orchestrates it, still handing the two real decisions (direction, ship) back to you.
