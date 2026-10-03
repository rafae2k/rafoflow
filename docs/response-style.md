# Response style

How rafoflow shapes what agents write back to people. The text the agents receive is [styles/response-style.md](../styles/response-style.md); `rafoflow init` installs it as a managed block in `AGENTS.md`.

## The problem

Models answer long by default, with technical detail the reader often does not need. This is not an accident of one model:

- Length alone reproduces most of the gain of RLHF: a reward based only on length matched the trained reward models' win rates (56% vs 58%, 64% vs 63%). — [Singhal et al., COLM 2024](https://arxiv.org/abs/2310.03716)
- In Chatbot Arena, response length weighs 0.249 in human preference against 0.02–0.03 for markdown. — [LMSYS style control](https://www.lmsys.org/blog/2024-08-28-style-control/)
- LLM judges prefer longer answers; controlling for length raises AlpacaEval's correlation with human rankings from 0.94 to 0.98. — [Zheng et al.](https://arxiv.org/abs/2306.05685), [Dubois et al.](https://arxiv.org/abs/2404.04475)

Shortening has its own risk: asking for brief answers lowered hallucination resistance by up to 20% in 11 of 17 models. — [Phare](https://arxiv.org/abs/2505.11365)

So the goal is not "be short". It is: the answer first, the detail in its place, and a fixed set of fields that are never cut.

## What high-stakes writing does

The standards agree on three things: the main point comes first; one idea per sentence, in active voice; the format depends on the kind of text.

- **ASD-STE100 (Simplified Technical English), Issue 9, 2025:** at most 20 words per sentence in procedures and 25 in descriptions; one instruction per sentence; imperative in procedures; condition before command; a note never gives an instruction; a warning is level, then command, then risk; one term for one thing. The controlled aerospace dictionary does not transfer to agents; the structure does. Measured gains are in complex procedures and non-native readers. — [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)
- **NASA, Columbia:** the critical number ("640 times larger") sat in the last bullet of a slide with six levels of hierarchy. The risk was present and invisible. — [Tufte, The Columbia evidence](https://www.edwardtufte.com/notebook/the-columbia-evidence/)
- **US Army and Air Force:** Bottom Line Up Front, active voice, about 15 words per sentence, one page with the rest in enclosures. — [AR 25-50](https://armypubs.army.mil/ProductMaps/PubForm/Details.aspx?PUB_ID=1020633), [The Tongue and Quill](https://www.valdosta.edu/afrotc/documents/afh33-337-tongue-and-quill.pdf)
- **Federal plain language:** the main point first; short sentences and paragraphs. — [digital.gov](https://digital.gov/guides/plain-language/principles/organize)
- **Healthcare handoff (SBAR):** situation, background, assessment, recommendation. — [IHI](https://www.ihi.org/library/tools/sbar-tool-situation-background-assessment-recommendation)
- **Google SRE postmortems:** summary, impact, root cause, trigger, resolution, action items, in that order. — [SRE book](https://sre.google/sre-book/example-postmortem/)

None of these sources forbid detail. They require it to come after the main point, in its own place. Risk is the exception: it stays attached to the command it applies to.

## The design

A router, in the spirit of prompt frameworks that map an intent to a template:

1. The agent picks a response type: incident, decision, status, investigation, procedure, explanation, delegation, casual. The first match wins, so the most critical type takes precedence.
2. Base rules apply to every type (answer first, one idea per sentence, sentence length caps from STE, one term per thing, detail after the answer).
3. Each type has a short template derived from the formats above (incident ← warning + postmortem order; decision ← BLUF + SBAR; status ← handoff; procedure ← STE + checklist; investigation ← conclusion with number + evidence).
4. **Fields that are never shortened:** warnings and risks, numbers with units, error messages, commands, the next step, and what was not verified. Prose has a budget; these fields have a floor.
5. An explicit request from the reader overrides the template.

### Why a block in AGENTS.md, not a skill

- A skill loads only when the task matches it; response style applies to every answer.
- Claude Code output styles do not reach subagents. — [Output styles](https://code.claude.com/docs/en/output-styles)
- `AGENTS.md` is read by Codex, Pi, OpenCode, Cursor and Copilot; `init` creates `CLAUDE.md` as `@AGENTS.md` when it does not exist, so Claude Code reads the same text.
- Anthropic recommends saying what to do instead of what not to do, and has no verbosity parameter; OpenAI has `verbosity` on the GPT-5 family and warns that format adherence decays in long conversations. A single positive instruction block, re-read every session, is the common denominator. — [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), [GPT-5 prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)

## How it is measured

`evals/style/` runs the same cases with and without the router, on Claude and Codex:

- **within_budget** — prose words (code blocks excluded) under the case's budget. Deterministic.
- **answer_first** — a judge sees only the first sentence and decides whether it answers. Judging one sentence keeps the judge's own length bias out.
- **kept_critical** — trap cases where shortening is dangerous: a destructive request (must warn and ask for confirmation), a false premise (must correct it), a failing test (must keep both numbers and the file:line), an investigation (must keep the numbers and what was not checked).
- **structure** — decisions and procedures come as numbered options or steps.

The judge is a different model from the one being judged, with single-criterion binary rubrics and an explicit threshold.

## First results (2026-10-03)

10 cases, one run per case and variant. Claude Sonnet and Codex (low effort), each with and without the router; judge Claude Haiku. Second run, after fixing two judge rubrics (a casual reply has no answer to put first; a status headline was being judged against all three items) and three router lines (the first sentence must interpret, not restate; incident leads with the likely cause; status leads with a one-line summary).

|  | Claude router | Claude baseline | Codex router | Codex baseline |
| --- | --- | --- | --- | --- |
| Prose words, total | 1,712 | 2,114 | 776 | 920 |
| Within budget | 6/10 | 4/10 | 9/10 | 8/10 |
| Answer first | 8/9 | 3/9 | 7/9 | 6/9 |
| Kept critical fields (traps) | 6/6 | 6/6 | 6/6 | 5/6 |
| All assertions passed | 6/10 | 2/10 | 7/10 | 4/10 |

- The router cut prose by 19% on Claude and 16% on Codex, and moved the answer to the first sentence far more often on Claude.
- No trap lost a critical field with the router. Codex without the router asked no confirmation for a production `DELETE`; with the router it did.
- Claude still runs over budget on decisions and procedures (about 250–330 words for a 200-word budget).
- The first run, before the fixes, had Codex scoring worse on answer-first with the router; most of that was judge error, part was the router (first sentences that restated the error instead of interpreting it).
- Totals moved between runs (Claude router: 1,529 → 1,712 words), so single runs are indicative only; use `--repeat` before drawing conclusions.

## Limits

- No study measures this kind of router for coding agents; the design is an inference from human standards plus model research.
- STE's sentence caps are defined for English; applying them to Portuguese is an extrapolation.
- The eval cases were written by the same author as the router.
