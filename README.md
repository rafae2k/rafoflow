# rafoflow v2

A shareable, customizable development process for coding agents — the same process in any repository, across harnesses (Claude Code, Codex, Pi) and model vendors.

> **Status:** design phase. v1 (the `shapeup` Claude Code plugin) lives on `main` and is tagged `v1.0.0`. v2 starts from scratch on this branch.

## Why v2

Process written as long skills is advisory: the model decides whether to follow it, and adherence drops when you switch models or harnesses. Teams that run agents at scale keep the guarantees in code (orchestrators, gates, CI) and keep the prose short. v1 was prose, and only worked in Claude Code.

v2 moves the guarantees into a small CLI and keeps the skills thin:

- **Base skills** — short `SKILL.md` files (open standard, read by every major harness) that orient the agent and call the CLI for anything that must happen.
- **Base agents** — roles (classifier, researcher, planner, implementer, reviewer, fixer, doc-gardener) defined as prompt + allowed tools + output schema, executed by the orchestrator in any harness.
- **Model routing by complexity** — an LLM classifier assigns each piece of work a tier; a role × tier table picks harness, model and reasoning effort.
- **Process and verification loops** — phases in code with typed outcomes (`done`, `blocked`, `needs_research`, `needs_poc`), a review loop that stops on convergence, gates from the repo's own commands, human checkpoints.

Each repository declares only what is its own (commands, docs paths, risk markers) in a contract file, and inherits the rest explicitly from the package and from an optional organization preset.

## Docs

- [docs/design.md](docs/design.md) — the v0 design.
- [docs/research.md](docs/research.md) — what the design is based on, with sources.
- [spike/](spike/) — the review-loop spike that validated the core mechanism.

## License

MIT
