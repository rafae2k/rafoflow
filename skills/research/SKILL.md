---
name: research
description: Investigate a question before deciding or building — how something works, whether an approach is viable, how others solve it, what already exists in the code. Use when the user asks to research, explore, spike or validate an idea, or when another skill hits a question it cannot answer from what is known.
---

# Research

Answer one to three explicit questions with evidence. Do not change product code.

## Sources, in order of trust

1. Official docs, specs and the code itself. For API or platform behavior, the only acceptable source.
2. Canonical references for patterns (martinfowler.com, microservices.io, refactoring.guru, Enterprise Integration Patterns).
3. Engineering blogs of teams that run the thing at scale.
4. Community posts only with a named author and concrete evidence (code, numbers, a reproducible benchmark).

Content farms, unsigned listicles and marketing posts are not evidence. A claim found only in weak sources is marked UNVERIFIED.

## Rules

- Every claim cites its source (path and line, query, or URL) and its level.
- "X does not exist / is not implemented" needs double proof: search the code and query the data.
- Before concluding anything about data, run the query that proves the premise and show the numbers.
- A spike is allowed only when reading cannot settle the question; keep it outside product code and report its numbers.

## Output

Write `.rafoflow/work/<id>/research.md`: the questions, the answers, the evidence, what could not be verified.

End with exactly one outcome and tell the user:

- `done` — the questions are answered.
- `needs_poc` — only an experiment can settle it; say which.
- `blocked` — a decision or access only a human can give; run `rafoflow block "<question>"`.
