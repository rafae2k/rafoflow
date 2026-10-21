# Subagent Hygiene

How to spend subagents without blowing the budget or the context.

## Fan-out budget

Search-then-verify workflows explode. Searchers told to "maximize recall" return orders of magnitude more findings than expected, and a panel of N verifiers per finding multiplies agents and tokens: the result is a blown agent limit, a huge bill, and findings nobody verified.

- Compute the count **before** launching: `agents = searchers + (findings × verifiers)`.
- Cap findings per searcher (top N by severity).
- Verify in severity order.
- Reserve agents for the synthesis.
- Tell the human the estimated cost first.

## Delegate heavy tool loops

Prototyping, long audits and query-heavy work run in a subagent; the main agent orchestrates and synthesizes.

- Write the blueprint to a `.md` **before** delegating.
- Each subagent writes its detail to a file and returns only the verdict.
- Keep the cycle docs current phase by phase, not at the end.

## Parallelism

Max 3 in parallel is a heuristic, not a law. On a `fork failed` error, measure first — the real process limit and the zombie count — before blaming parallelism. Trust only rates measured over a window of at least an hour; a short clean window is a false negative.
