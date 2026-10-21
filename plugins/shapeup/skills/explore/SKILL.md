---
name: explore
description: "Research-only step, standalone: explore an idea, run a spike, check feasibility, understand a problem space. No cycle, no task, read-only on product code. Ends in an explicit exit — cycle, task, backlog, or dies here."
argument-hint: "[the idea or question]"
---

# Explore: Research Without Commitment

Find out whether something is worth doing before deciding to do it. Explore opens no cycle and no task, and never changes product code. It exists so that "will this work?" has a cheap, honest answer.

## Process

1. **Frame** — turn the ask into 1–3 questions the research must answer. If you can't, the ask isn't ready.
2. **Classify the question before acting** — a lookup (catalog/attribute), an aggregate (volume), a state (snapshot), a cause (trace of events), or a forecast (schedule). The class picks the method. An answer that invents a concept outside the domain is an artifact — redo it.
3. **Investigate** — use only the angles the question needs: codebase, real data, external sources (see `/market-research`). A spike is allowed only when reading can't prove it: minimal, throwaway, outside the repo. The result is evidence; the code dies.
4. **Deliver** — a picture in ≤5 lines in chat, then numbered findings with evidence (apply `/cycle` → `references/evidence-discipline.md`). Durable value → a dated, immutable analysis doc. Shallow → chat only.
5. **Exit — always explicit, never automatic.** Pick one and say why:
   - becomes a **cycle** (direction is open)
   - becomes a **task** (small and understood)
   - goes to the **backlog**
   - **dies here** — with the evidence of why, so nobody re-researches it in three months

## Calibrate effort

A simple question is one query or one read — no multi-agent, no deep research. Start light; never skip the verification. Where a read-only empirical test can settle a question, run it instead of asking the user.

## Rules

- NEVER modify product code. NEVER open a cycle or task on your own: the exit is a recommendation until the user says yes.
- NEVER leave without an exit. "Interesting" is not an exit.
- A finding without evidence is a hypothesis; label it as one.
