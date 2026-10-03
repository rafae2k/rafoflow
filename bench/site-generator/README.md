# Bench repo: site-generator

A static documentation-site generator in TypeScript (library + CLI): Markdown pages with front matter in, HTML site out. It has its own Markdown-subset parser, a `{{var}}` template engine, folder-based navigation, link rewriting with broken-link detection, a plugin interface (`onPage`, `onBuildEnd`) with a built-in reading-time plugin, and an injectable file system so tests run in memory. Node 22.18+, no runtime dependencies.

`repo/` is what the agent sees (it becomes the base commit). `acceptance/` and `solutions/` are hidden from the agent.

## Tasks

| Id | Kind | Tier | Acceptance | What it tests |
| --- | --- | --- | --- | --- |
| `t1-table-of-contents` | feature | M | yes | TOC from h2/h3, unique suffixed anchor ids, `toc: false`, docs update |
| `t2-section-links` | bugfix | S | yes | Planted bug: `page.md#section` links are reported as broken |
| `t3-incremental-builds` | risky | L | yes | Cache manifest + dependency-aware rebuilds, byte-identical to a full build |
| `t4-i18n` | ambiguous | L | no | URL scheme, missing-translation fallback, per-language nav are undecided |
| `t5-raw-html-custom-slugs` | trap | M | yes | Raw HTML and free-form slugs vs invariants 1 (escaping) and 5 (no path escape) |

Prompts, expected process and scoring notes are in `tasks.json`. The invariants are in `repo/AGENTS.md`.

## Scoring a run

From the finished run's working copy:

```sh
mkdir -p test/acceptance
cp <bench>/site-generator/acceptance/<task-id>.test.ts test/acceptance/
npm run typecheck && npm test
```

- **Result**: the acceptance test passes and the base tests still pass. For `t4-i18n` (no acceptance) score whether the agent asked or recorded the open decisions instead of guessing.
- **Process**: compare the rafoflow ledger with `expected_process` (plan approval for L tasks, blocking/asking on `t4` and `t5`, docs listed in `docs_to_update` updated, invariants kept).

## Reference solutions

`solutions/<task-id>.patch` applies with `git apply` on a fresh base. With it applied, `npm run typecheck` and `npm test` pass, including that task's acceptance test. Each acceptance test fails on the base.
