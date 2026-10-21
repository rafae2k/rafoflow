# Name search

Builds the filters that the search backend runs.

## Invariants

1. The production backend rejects a LIKE pattern longer than 50 bytes. The local development backend accepts 50,000, so a local test does not catch it. A filter must never be built from a pattern that can exceed 50 bytes: split it into several patterns.
2. A behavior that depends on the production backend (limits, collation, engine version) is not "tested" until it ran against the production backend. CHANGES.md must say where and with which command; "tested locally" does not count.
