---
name: cycle
description: "Run a full Shape Up cycle end-to-end — research → shape → bet → scope → build → review → ship — orchestrated in one flow with persistent artifacts and two human checkpoints. Use when you want the whole workflow driven for you instead of invoking each skill by hand."
argument-hint: "[goal in one sentence]"
---

# Cycle: The Full Loop, Orchestrated

The other shapeup skills are the _methods_. This is the _conductor_ that runs them in sequence, writes a durable trail as it goes, and pauses only where a human genuinely decides. Fixed time, variable scope — start to ship in one flow.

> `flow-router` says "no orchestrator — you decide." `/cycle` is the opt-in exception for solo velocity: you still own the **two decisions that matter** (direction and ship); everything between runs autonomously. If you'd rather drive each step by hand, don't use `/cycle` — call `/shape`, `/scope`, `/engineer` yourself.

## Modes

**Orchestrated (default)** — you give the goal in one sentence; the pipeline runs with exactly **two pauses**:

```
goal → research (parallel subagents) → shape → BET ①  → scope → spec → build+tests (+POC when needed) → SHIP ②  → review + verify
```

**Step-by-step** — if the goal is exploratory ("figure out how to solve X") or you ask for it: pause for approval at the end of research, shape, and scope too.

Rule of thumb: clear, measurable goal → orchestrated. Vague, exploratory goal → step-by-step.

## It's a cycle, not an arrow

Phases advance in order, but **any phase can send you back**, and that is the process working — not a failure:

- Building reveals new complexity → back to research/spec (update the artifact _first_, never improvise past the spec).
- Review rejects an item → back to build.
- A surviving mutant in business logic → back to tests.
- Production doesn't confirm the new behavior → back to the diagnosis.

The only forbidden moves: skipping a phase _forward_, or continuing against a spec you've let go stale.

## Phase 0 — Setup

1. Number the cycle: `ls docs/cycles/` and increment.
2. Create `docs/cycles/NN-slug/` with a `README.md` — status, problem, tasks checklist, and "done means …".
3. Start the living plan (a todo list of the phases). Keep it current — it's how the human follows along without babysitting.

## Phase 1 — Research (`research.md`) · parallel subagents

Spawn up to **3** investigators in the same turn (more than 3 risks fork exhaustion on macOS), each with a closed scope:

1. **Codebase** — relevant code with file paths + line numbers, data model, the patterns already here to reuse.
2. **Runtime / data** — the real system state. Query the source of truth directly; never assume a status/field's meaning — read the actual distribution first. (Follow the production-investigation rules in `/debug`.)
3. **External** — how the field solves this, documented anti-patterns, official API/spec docs. Respect the source hierarchy below.

### Source hierarchy for external research

Source quality beats result quantity. In order of trust:

1. **Official docs & specs** — the platform/API's own documentation. For how an API or platform _behaves_, this is the only acceptable source.
2. **Canonical pattern references** — refactoring.guru, martinfowler.com, microservices.io, Enterprise Integration Patterns, Shape Up (basecamp.com). For design decisions, start here.
3. **Engineering blogs from people operating at scale** — real trade-offs and post-mortems.
4. **Individual/community posts** — only with a named author and concrete evidence (code, numbers, a reproducible benchmark).

**Banned as evidence:** SEO content farms, authorless listicles, AI-generated blog spam, marketing dressed as a technical article. If a claim only exists there, treat it as **unverified** — prove it by POC/query or drop it. Every claim in `research.md` cites its URL and tier; a tier-4 claim never carries an architectural decision alone.

Synthesize into `research.md` (numbered parts, tables with concrete data, file paths, URLs, derived decisions). **"Doesn't exist / isn't implemented" needs double proof** — grep the code AND query the runtime — before it enters research as fact.

In orchestrated mode: **don't pause** — flow straight into shaping, accumulating any open decisions.

## Phase 2 — Shape (`pitch.md`) → Checkpoint ①

Run `/shape` on the goal, grounded in the research (reference the evidence, don't invent). Output a pitch: problem · appetite · solution (fat-marker sketch) · rabbit holes · no-gos.

### CHECKPOINT ① — Bet on the direction

Present: a 3–5 finding summary from research + the full pitch. Then **one batched question** carrying the genuine direction decisions accumulated so far:

- Architectural choices with a real trade-off (2+ defensible options) — with your recommendation marked.
- Appetite / scope cut if research surfaced more than the stated goal.
- Approval to proceed (the `/bet`: build, reshape, or kill).

What does **not** go in the checkpoint: decisions with an obvious answer from the project's conventions (just apply them), implementation detail (that's the spec), redundant confirmations. If there's no open architectural decision, the checkpoint still happens — present research + pitch and ask for the bet. Direction **always** passes through the human. Only after the bet does the spec get written.

## Phase 3 — Scope + Spec (`spec.md`)

Run `/scope` to break the bet into 3–5 independent, valuable slices (most uncertain first). Then write the technical `spec.md`, derived from the approved pitch: flow, each task by file path (change / new), its tests, and deploy order.

Rules: reference existing code by path; real strings, not placeholders; each task independently shippable where possible; **each task carries its own tests in the spec** — including an integration test if it touches a critical boundary (see `/engineer` → Testing: Unit vs Seam).

In orchestrated mode the spec has **no pause of its own** — it's the technical translation of an already-approved direction. Exception: if speccing surfaces a _new_ architectural branch-point the pitch didn't cover, ask one pointed question before continuing.

### POC — only when needed

If the spec rests on a **critical assumption that reading code/docs/data can't prove**, the first task is a minimal, throwaway POC that validates it. "Needed" means: real behavior of an external API the docs don't guarantee; a platform limit near its ceiling; a performance assumption; a primitive new to this system. If research already proves the assumption with existing code, real data, or official docs — **skip the POC**; it's over-engineering.

## Phase 4 — Build → Checkpoint ②

Implement task by task per the spec (independent tasks → parallel subagents, max 3; coupled tasks → sequential). Delegate to `@engineer` or apply `/engineer` inline.

**Iterate until green — the loop already exists; don't stop before it closes.** The gate (typecheck/lint/build/test) is the deterministic iteration mechanism: implement → run → fail → fix the cause → repeat. Never end the phase on red saying "almost done".

Per task: implement → **tests alongside the code, never after ship** (bug fix ⟹ regression test) → run the gate → update `notes.md` with decisions and learnings. Schema / domain-event change ⟹ update the doc and any machine-readable catalog in the same task (see `/engineer` → You Own the Doc).

If a task reveals complexity that changes the spec: update README + spec first — and if it changes _direction_, ask; never expand scope silently.

### CHECKPOINT ② — Ship

Present: tasks done, gate result, a diff summary, pending migrations. Ask for explicit approval to ship. Then run `/ship`, write the changelog fragment (the gate denies a release without it), refresh the durable docs whose truth changed, deploy, and commit.

## Phase 5 — Review + verify

1. **Verify in the real system** — prove the new behavior actually happens (query / re-trigger / logs); measure before-vs-after when it applies.
2. Run `/review` (or `@reviewer`) against the spec: does it match, is it simple, are empty/error states handled?
3. Update the cycle `README.md` — tasks done, learnings — and mark it `done`.

## Artifacts

Every phase leaves a durable trail in `docs/cycles/NN-slug/`:

```
README.md     overview, tasks, "done means"
research.md   investigation: existing code, data, gaps, evidence (paths + URLs)
pitch.md      the shaped bet (problem / appetite / solution / no-gos)
spec.md       technical spec: tasks by file path, tests, deploy order
notes.md      decisions and learnings during the build
changelog.md  fragment: one line per change reaching prod
```

These follow the **durable × dated** discipline and a machine-readable frontmatter contract — read [references/artifact-discipline.md](references/artifact-discipline.md) before writing or moving any doc. A project can _enforce_ this with a docs-lint + changelog gate (the [rafoworks](https://github.com/rafae2k) boilerplate ships one); without enforcement, it's discipline you hold yourself.

## Guardrails

- **Never derive from the stated goal.** If research shows the real problem is different, that's a Checkpoint ① decision — never a silent expansion.
- **Decisions accumulate, they don't interrupt.** During research/shape/spec, note each open architectural decision instead of asking on the spot. Batch them all at Checkpoint ①.
- **Max 3 parallel subagents** — fork exhaustion on macOS beyond that.
- **Large deliverables go to a file** (write + summarize in chat), never dumped into the response.
- **Destructive production writes:** hand the user a ready-to-run script with a dry-run before and a confirming read after — don't execute blind.
