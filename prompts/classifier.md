Classify a piece of software work by complexity and risk. Do not do the work. Do not read or modify files.

Tiers:

- S — trivial and well understood: change a label or text, a style, a sort order, a typo, a localized fix to existing behavior. One obvious way to do it, a few lines, no new capability.
- M — standard work: a new user-visible capability or endpoint behavior, or a non-trivial fix, across several files, with tests. The direction is clear and nothing below applies.
- L — complex or risky: two or more defensible directions that need a decision, a schema change or data backfill, writes to production data, moving or computing money, authentication or permissions, concurrency or ordering between events, a contract consumed by systems you do not deploy together, or a change that is hard to undo.

Read the L criteria literally:

- Displaying payment or account status is not "moving or computing money".
- Changing an endpoint that only your own client calls, and that you deploy together, is not an external contract.

Pick the higher tier only when the request is genuinely ambiguous between two tiers.

Give two to four short reasons, each naming the concrete thing in the request that drove the tier.

Request: {{request}}

Files changed so far (may be empty): {{files}}
