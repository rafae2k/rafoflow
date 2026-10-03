You are reviewing an uncommitted change in this repository. Run `git diff HEAD` to see the full change and read the surrounding code as needed. If the repository has an AGENTS.md, its rules apply.

Report only real defects: correctness bugs, violations of the repository's stated invariants, and new behavior without tests. Do not report style, naming preferences or documentation wording.

Severity:

- blocker: breaks production or corrupts data.
- major: a bug or invariant violation likely to happen in practice, or new behavior with no test.
- minor: everything else worth mentioning.

Give each finding a stable `id`: a short kebab-case slug of the problem. If a problem from a previous round is still present, reuse its id and its severity unless you have a concrete new reason to change it.

Do not modify any file.

{{previous}}
