# Artifact Discipline

How the docs a cycle produces stay trustworthy instead of rotting. This is the contract that lets `docs/` guide an agent: where each thing lives, the machine-readable frontmatter that routes context, and what "in the standard" means. Read it before writing or moving any doc.

## The principle: durable × dated

Every doc is one of two things, and this decides everything:

- **Durable** — describes what is **true now**. If it changes, **edit it in place**. It never rots; at worst it goes stale and you correct it. (architecture, business rules, integrations, runbooks)
- **Dated** — records what **happened at a moment**. It's **immutable**: you don't edit it, you **supersede** it (`status: superseded` + `superseded_by`). (cycles, incidents, analyses, ADRs)

Mixing the two is the root of drift: nobody can tell, looking at a file, whether it's the current truth or an old snapshot.

## Frontmatter (the machine contract)

Every doc carries this block on top. It's what routes agent context and what a docs-lint can enforce:

```yaml
---
type: rule # what it is (enum below)
status: current # lifecycle
updated: 2026-07-11 # last change to the file (content OR move/format)
reviewed: 2026-07-11 # last time content was CHECKED against code/runtime and confirmed true
area: billing # domain, to scope agent context
superseded_by: ../x.md # required when status: superseded
---
```

- **`type`** — `architecture` · `vision` · `rule` · `integration` · `reference` · `runbook` · `spec` · `adr` · `incident` · `analysis` · `cycle` · `changelog` · `index`. Routes context and defines what "in the standard" means for that doc.
- **`status`** — durable: `current` · `superseded`. ADR: `proposed` · `accepted` · `superseded`. Cycle: `in_progress` · `done` · `parked`.
- **`updated`** — last change to the **file**, including a move or reformat, not just content.
- **`reviewed`** — the anti-stale field, and the subtle one. It moves **only** when someone **proves** the content against the source (code/runtime) and confirms it's still true. A structural commit (a move, a formatter run) bumps `updated` but must **not** bump `reviewed` — otherwise the freshness date lies. This distinction is hard-won: without it, "updated" quietly becomes the date of a migration over content nobody re-checked, and a structure-only lint can't catch it.
- **`area`** — a controlled vocabulary of domains, so a loop loads only the context for its goal. Register a new value in your docs-lint before using it (anti-drift).
- **`superseded_by`** — relative path to the successor. Required and must resolve when `status: superseded`.

## "In the standard" by type

| type | what "ready" looks like |
| --- | --- |
| `rule` | the rule in one line + **why** + **where it applies** (link to the code that enforces it) |
| `adr` | context · decision · consequences · status. Numbered. Immutable once accepted — supersede |
| `integration` | our side of the mapping; the vendor's API doc lives separately |
| `architecture`/`vision` | prose of the current state, edited in place |
| `runbook` | numbered steps to perform one task |
| `incident` | post-mortem: what happened · impact · root cause · fix · prevention. Immutable |
| `analysis` | a dated finding. Immutable; `superseded_by` when replaced |
| `cycle` | research / pitch / spec / notes / changelog per cycle |
| `changelog` | a per-cycle fragment, collated into the root (see below) |

## Cross-cutting rules

- **You own the doc.** The agent that writes the code owns the docs the change makes untrue. Updating them is part of the task, not a "later" step — later never comes. This is why a gate enforces it.
- **The future lives in one place.** A doc describes what _is_. Intent checkboxes (`- [ ]`) belong only in cycle docs and a single `backlog.md`. In a durable doc, the future is a link to the backlog.
- **The index doesn't lie.** Every doc in an indexed area is linked from its neighbor README, and every index link resolves.
- **Dated analysis has a home.** One-off analyses/research live in their dated folder, never loose at the root of `docs/`.
- **Changelog = per-cycle fragment, generated root** (the towncrier / changesets pattern). Each cycle writes `docs/cycles/NN/changelog.md` (`- YYYY-MM-DD — what changes in prod`, code-confirmed). A collate step assembles the root `changelog.md` between generated markers. No merge conflicts (one file per cycle), narrative reading (generated root). Don't hand-edit the generated region.

## Enforcement (why this doesn't rot)

Discipline that isn't enforced is a suggestion. A project makes this non-optional with a gate wired into a pre-tool / pre-commit hook:

- **docs-lint** — frontmatter valid, links resolve, no intent checkbox in a durable doc, no dated analysis at the root.
- **changelog-guard** — code touched under `src/` without a matching changelog fragment ⟹ the commit/deploy is denied.
- **changelog-sync** — the generated root must match the fragments.

Make the lint **incremental**: enforce the standard on already-migrated docs (the ones with frontmatter) and only _warn_ on the rest, so rigor tightens as coverage grows without blocking untouched files. The [rafoworks](https://github.com/rafae2k) boilerplate ships generic versions of these scripts and the hook that runs them.
