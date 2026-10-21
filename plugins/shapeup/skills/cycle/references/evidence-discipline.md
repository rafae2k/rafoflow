# Evidence Discipline

The gap between "it passed" and "it's true" lives in a few habits. Apply them to research, specs, debugging and reports.

## Provenance of proof

Every "tested", "verified" or "confirmed" states **where** (the exact engine/environment) and **with what** (the command or query). "Tested locally" alone is not proof.

- Proof counts only on the engine that runs in production. A local database doesn't prove the managed one; one runtime doesn't prove another; one browser doesn't prove another; a vendor's documentation doesn't prove the real payload.
- What you could only prove on a stand-in goes into the **test-vs-prod differences** list (see [risk-and-verification.md](risk-and-verification.md)) — accepted with a reason, or eliminated.

## Lists come from counts, not memory

A list that must be complete (columns, callers, limits, endpoints) is produced by a command, not recalled. Record the command and the total. When copying a platform's limits, copy the **whole** official table, not the row that looks relevant — the row you skipped is usually the one that bites.

## Before recommending an architecture change

1. Read the research and spec of the cycle that introduced the thing — it often already decided what you were about to "reframe".
2. Backtest against real data, read-only.
3. **Partition before you count.** An aggregate over an un-partitioned population merges two truths (historical vs live, one origin vs another). Split it, then reconcile with a known baseline before presenting.

## Triaging third-party feedback

Per item, cite proof in the code or API (where, since when, which endpoint) **and** check whether the owner already decided it (git log, changelog, cycle notes). Mark "already decided on DATE" when the request contradicts a prior decision. No item enters the list on a hunch.
