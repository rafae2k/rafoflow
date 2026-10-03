# Research behind the design

Summary of a research round done on 2026-09-30 (official docs, canonical references, engineering blogs, and primary texts from practitioners). Each point cites its source. Where a point is an inference rather than something a source states, it says so.

## 1. Process in prompts is advisory

- Anthropic separates _workflows_ (predefined code paths) from _agents_ (the model directs the flow). A phased process written as a skill is a workflow whose control has been handed to the model (inference). — [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- 12-factor agents, factor 8: own your control flow. — [humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md)
- Claude Code docs call `CLAUDE.md` advisory and hooks deterministic. — [Memory](https://code.claude.com/docs/en/memory), [Hooks](https://code.claude.com/docs/en/hooks)
- Skill activation is a model decision. Vercel measured a skill never being invoked in 56% of cases, against 100% pass rate with an index embedded in `AGENTS.md` (model not stated). — [Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- Even with templates and checklists, agents frequently do not follow all instructions. — [Böckeler, martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

## 2. What is portable across harnesses

- The real common denominator is a markdown instructions file ([AGENTS.md](https://agents.md/)), the `SKILL.md` folder ([Agent Skills spec](https://agentskills.io/specification)), MCP, and a headless mode with JSON output ([Claude Code headless](https://code.claude.com/docs/en/headless), [Codex non-interactive](https://developers.openai.com/codex/noninteractive)).
- Hooks, subagents, commands and permissions are outside every open standard, and each harness registers them differently ([Claude Code hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://developers.openai.com/codex/hooks)).
- No practitioner or company found reports keeping the same process at parity across several harnesses through instructions alone (inference from the absence of reports; see sections 4 and 5).

## 3. The harness changes the result

- Same model, different harness: on Terminal-Bench 2.0, Opus 4.6 ranges from 58.0% (Claude Code) to 76.4% (another harness). — [Terminal-Bench leaderboard](https://www.tbench.ai/leaderboard/terminal-bench/2.0)
- LangChain moved the same model from 52.8% to 66.5% by changing only the harness. — [LangChain](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering)
- These measure task resolution, not process adherence. No controlled public measurement of process adherence across harnesses or vendors was found.

## 4. How companies run agents with teams

- What gets centralized is environment and verification (sandbox, curated tools, verifiers, CI), not prompts. — [Stripe Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents), [Spotify background coding agents](https://engineering.atspotify.com/2025/11/spotifys-background-coding-agent-part-1), [Ramp](https://builders.ramp.com/post/why-we-built-our-background-agent)
- The guarantee lives on the server: isolated agent → PR → CI → human merge → deploy through the pipeline. Local hooks are fast feedback, never the last barrier.
- Harness engineering: guides and sensors, computational and inferential checks. — [OpenAI](https://openai.com/index/harness-engineering/), [Böckeler](https://martinfowler.com/articles/harness-engineering.html)
- Platform quality is linked to returns from AI. — [DORA 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)

## 5. What practitioners say

- Synthesis of about 60 primary texts from 17 practitioners (2025–2026): two camps. _Less process, more model_: removing plan modes, slash commands and specialized subagents as models improve. _Explicit process_: phases with file artifacts, fresh sessions between phases, a separate reviewer (for example [HumanLayer, advanced context engineering](https://www.humanlayer.com/blog/advanced-context-engineering)). Both camps agree that what must be guaranteed goes into code (commit hooks, linters, scripts).
- Instruction file size is contested: one practitioner generates ~800 lines, HumanLayer keeps theirs under 60. — [HumanLayer, writing a good CLAUDE.md](https://www.humanlayer.com/blog/writing-a-good-claude-md)
- No one describes an automatic mechanism to return from implementation to research when blocked; it is human discipline plus cheap artifacts. Graph engines are the exception that make it an explicit edge.
- The Ralph loop: a bash loop with fresh context per iteration. — [ghuntley.com/ralph](https://ghuntley.com/ralph/)
- Using an AI step as a placeholder that later becomes deterministic code. — [Shopify, Introducing Roast](https://shopify.engineering/introducing-roast)

## 6. Sharing process across repositories

- Live references (Renovate presets, reusable workflows) update automatically and can break everyone at once; tracked copies (copier, cruft) detect drift; untracked copies have no update path. — [Renovate presets](https://docs.renovatebot.com/config-presets/)
- Renovate recommends that each repository declares the preset it extends, instead of inheriting silently.
- GitHub distinguishes defaults that can be overridden from restrictions that only tighten ("the most restrictive version applies"). — [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- Every repository exposes the same command names and the generic process calls only those. — [Scripts to Rule Them All](https://github.blog/engineering/engineering-principles/scripts-to-rule-them-all/)
- Spotify separates creating from maintaining: templates scaffold, fleet-wide automated changes keep consistency. — [Golden paths](https://engineering.atspotify.com/2020/08/how-we-use-golden-paths-to-solve-fragmentation-in-our-software-ecosystem/), [Fleet management](https://engineering.atspotify.com/2023/05/fleet-management-at-spotify-part-3-fleet-wide-refactoring)

## 7. Measuring adherence

- `claude plugin eval` checks tool use and order and compares with and without a plugin; it runs only in Claude Code. — [Plugin evals](https://code.claude.com/docs/en/plugin-evals)
- Anthropic and OpenAI describe the same method: deterministic checks over the trace plus a rubric judge, several runs, with and without the skill. — [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)
- No official tool from a model vendor runs the same suite across more than one harness. promptfoo (third party, open source) does: first-party providers for the Claude Agent SDK, the OpenAI Codex SDK and the OpenCode SDK, `skill-used` assertions, trajectory assertions over traces, disposable workspaces with the agent's diff, and `--repeat` for variance. — [Evaluate coding agents](https://www.promptfoo.dev/docs/guides/evaluate-coding-agents/), [Test agent skills](https://www.promptfoo.dev/docs/guides/test-agent-skills/)

## 8. Authentication for automation

- Anthropic: OAuth (subscription) login is meant for ordinary use of Claude Code and native Anthropic apps; developers building products should use API keys; enforcement may happen without notice. — [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- OpenAI recommends API key authentication for programmatic Codex CLI workflows such as CI. — [Codex authentication](https://developers.openai.com/codex/auth)
