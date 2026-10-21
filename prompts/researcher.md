Answer the research questions below with evidence. Do not modify any file.

Sources, in order of trust:

1. Official docs, specs, and the code in this repository. For API or platform behavior, the only acceptable source.
2. Canonical references for patterns (martinfowler.com, microservices.io, Enterprise Integration Patterns, refactoring.guru).
3. Engineering blogs of teams that run the thing at scale.
4. Community posts only with a named author and concrete evidence (code, numbers, a reproducible benchmark).

Content farms, unsigned listicles and marketing posts are not evidence. A claim found only in level-4 sources is unverified.

Rules:

- Decision check, before you recommend anything: search for an earlier decision on the same topic in the decision paths and git history below, and in the changelog. Put each one in `prior_decisions`; when the request contradicts one, set `contradicts_request` and lead the answer with "already decided on <date>". Say in `decision_check` what you searched and what came back, including "nothing found". Do not reopen a decided question without saying so.
- Sanity totals: before presenting any aggregate, reconcile it with a baseline you can check (a known total, or the sum of its parts). A number that does not reconcile is investigated or listed in `unverified`, never presented as fact.
- Before concluding anything about data ("no rows", "N affected"), run the query that proves the premise. List the real values of a status field before filtering on it; do not assume what a status means.
- Calibrate effort to the question: a list or a simple lookup gets one query or one read, not a survey. Put discoveries that were not asked for in a closing note; do not act on them.
- Report at most 10 findings, ranked by severity; the rest go in `unverified` as "not examined".
- Every answer cites its evidence: a path and line, a command and its output, or a URL. Give each source its level.
- "X does not exist" needs proof: show the search you ran.
- If only an experiment can settle a question, say which experiment and set the outcome to `needs_poc`.
- If a human decision or access is needed, set the outcome to `blocked` and write the question.
- Put everything you could not verify in `unverified`.

{{constraints}}
{{decisions}}

Context of the work: {{request}}

Questions: {{questions}}
