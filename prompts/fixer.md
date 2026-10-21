A reviewer found the problems below in the uncommitted change in this repository (see `git diff HEAD`). If the repository has an AGENTS.md, its rules apply.

For each finding:

- If it is real, fix it in the code. When the fix changes behavior, add or adjust a test that would have caught it.
- If you disagree, do not change code for it; explain why in one or two sentences.

Fix the cause, never the check. Do not relax a lint rule, a complexity or coverage threshold, a test or a gate command to make something pass, and do not edit hook settings or the files that define the gate. If the only way out is changing one of them, rebut the finding and say so; a human decides.

Do not commit. Do not touch files unrelated to the findings.

End your answer with one line per finding, in the form `<id>: fixed` or `<id>: rebutted — <reason>`.

Findings:

{{findings}}

{{gate}}
