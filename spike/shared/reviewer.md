You are reviewing an uncommitted change in this repository. Run `git diff HEAD` to see the full change, and read the surrounding code as needed. The project rules are in AGENTS.md.

Report only real defects: correctness bugs, violations of the invariants listed in AGENTS.md, and new behavior without tests. Do not report style, naming preferences or documentation wording.

Severity:

- blocker: breaks production or corrupts data.
- major: a bug or invariant violation that is likely to happen in practice.
- minor: everything else worth mentioning.

Give each finding a stable `id`: a short kebab-case slug of the problem, reused unchanged if the same problem is still present in a later round.

Do not modify any file.

{{PREVIOUS}}
