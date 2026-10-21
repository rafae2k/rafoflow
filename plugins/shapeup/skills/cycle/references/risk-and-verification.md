# Risk Class and Verification

Rigor should scale with the damage a change can do, not be uniform. The spec declares a risk class; the class decides how much verification the cycle owes before it ships.

## Risk class

Declared in the spec frontmatter as `risk: A|B|C`, with the reason in the first lines of the spec.

- **A** — money, canonical writes, customer data, migrations/triggers/defaults, third-party contracts, anything that does not undo itself.
- **B** — internal logic with no canonical write (read-only job, metric, panel, derived event).
- **C** — UI copy, docs, refactor with no observable change.

When in doubt, go one class up.

| Section in the spec | A | B | C |
| --- | --- | --- | --- |
| Failure modes | yes | critical parts | - |
| Verification matrix | yes | yes | - |
| Test-vs-prod differences | yes | yes | - |
| Interfaces (unit/format/timezone) | yes | if any | - |
| Independent spec review | 3 roles | 1 reviewer | - |

Default failure posture: **fail small.** Bad input becomes empty + alert, never takes down the whole fact.

## The sections

- **Failure modes** — one row per critical part: how it fails · effect · severity · how it is detected · mitigation or undo.
- **Verification matrix** — one row per requirement: method (test / analysis / inspection / demonstration) · where it runs · evidence. A row without evidence is not verified.
- **Test-vs-prod differences** — every way the test environment differs from production (engine, runtime, data volume, payload source). Each one is either _accepted with a reason_ or _eliminated_. See [evidence-discipline.md](evidence-discipline.md) for what counts as proof.
- **Interfaces** — every value that crosses a boundary declares its unit, format and timezone.

## Independent spec review

Reviewers who never see the author's reasoning — only the spec, the repo and read access to production. Use `@spec-reviewer`, passing the role in the prompt.

- **Class A: 3 roles in parallel.**
  - _Architecture_ — does it close the source of the problem or patch a symptom? Is there a simpler way?
  - _Facts_ — re-check a sample of every claim; recount every list that claims to be complete.
  - _Production_ — what happens the first time it fires, the worst case, how it is undone, how we will know it broke.
- **Class B: 1 reviewer** (production).

**Every finding gets a destination** in a `Review findings` section of the spec: fixed (where) or rejected (why). A finding never just disappears; a `pending` finding blocks the ship.

## Readiness review (Checkpoint ②, class A/B)

Missing any item means the recommendation is **no-go**:

- the verification matrix has evidence on every row
- every test-vs-prod difference is accepted with a reason
- the undo is written _before_ applying (command/query), not after
- the post-deploy test is defined: the first real operation through the new path, and what to check
- the signal is defined: how we will know it broke (alert, query, panel)
