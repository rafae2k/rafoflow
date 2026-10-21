# Learning Loop, Incidents and Accepted Anomalies

Fixing the case is not enough. A process that only fixes cases makes the same mistake again next quarter. This reference is the closing question of every cycle, plus the two records that keep it honest.

## The closing question

For every error or near-miss found in the cycle — by review, during the build, or in production — answer:

> **Which layer should have caught this, and what changed in that layer?**

Valid answers: a **test** · a **gate rule** · a **fixed reviewer question** · a **line in the project rules**. "I fixed the case" is not an answer. If nothing changed in any layer, the same error is still possible and the cycle is not closed.

## Incident note (class A near-misses)

A class A near-miss — something that would have been bad had it landed — gets a short note, dated and immutable (type `incident`, see [artifact-discipline.md](artifact-discipline.md)):

```md
## What happened
## Impact (real or avoided)
## Root cause
## Fix
## Prevention — the layer that changed
```

`Prevention` must name the layer and point at the change (the test, the gate rule, the reviewer question, the rule line). A project can have its gate require this section.

## Anomaly is not normal

Normalization of deviance: an error that keeps happening gets quietly relabeled "benign" until nobody remembers it was ever a bug.

A recurring error may be called benign **only with a written acceptance**: the reason, and a **review-by date**. Without it, it is an open bug. A past review date means it is treated as open again.

Keep accepted anomalies in one register file:

```md
| Anomaly | Why it is accepted | Accepted on | Review by |
| --- | --- | --- | --- |
```

A gate or lint can fail on an expired date — that is the enforced version; without it, it is discipline you hold yourself.
