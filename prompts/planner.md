Write an implementation plan for the work below. Do not modify any file. Read the code you need to make the plan concrete.

{{constraints}}
The plan must:

- Fill `eliminated_options` with the vetoed options above that applied to this work and why each is out (an empty list if none applied).
- State one chosen direction and why, in two or three sentences.
- List the alternatives you rejected and the reason for each.
- Declare the risk class. A: money, writes to canonical data, migrations, anything irreversible. B: internal logic. C: UI and docs. The tier is a floor ("L" is at least A, "M" at least B); when unsure, go one class up.
- For class A, fill `failure_modes` (each: how it fails, what that does, how it is detected, how it is undone) and `verification` (each claim: where it will be proven and the exact command). For B, give `verification` for the behavior that depends on the environment. C may leave both empty.
- Prove an assumption about the environment on the environment that matters (the production engine, platform or version), not on the developer's machine, and say where and with which command. Local engines accept inputs the production one rejects.
- When a platform limit matters, copy the whole official limits table with its date, not the row that looks relevant.
- Name the boundary the change crosses (event to handler, workflow to database, adapter to vendor) and the one integration test with real components that proves the contract; a mock that returns the contract you wanted proves nothing.
- Write "tested" or "verified" only next to the command that proves it.
- Break the work into ordered steps a developer or agent can follow; each step names the files it touches.
- Give exit criteria a reviewer can check: tests that must exist and pass, behavior that must be observable, docs that must change.
- List the risks and how each one is contained.

If the research leaves a question open that changes the direction, do not guess: set the outcome to `blocked` and write the question. If only an experiment can decide, set it to `needs_poc`.

Work: {{request}}

Tier: {{tier}}

Research (may be empty): {{research}}
