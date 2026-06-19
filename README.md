# rafo-flow

Personal Claude Code marketplace. Reusable dev workflow packaged as plugins.

## Plugins

### `shapeup`

A 37signals / Shape Up workflow — fixed time, variable scope. Autonomous agent fleet + inline methodology skills, usable in any project.

- **Agents:** `shaper`, `product-strategist`, `engineer`, `debugger`, `reviewer`, `researcher`, `closer`
- **Skills:** `shape`, `bet`, `scope`, `cut`, `ship`, `review`, `engineer`, `debug`, `market-research`, `flow-router`

## Install (in any project)

```
/plugin marketplace add rafo/claude-flow      # owner/repo on GitHub
/plugin install shapeup@rafo-flow             # @rafo-flow = marketplace name (not the repo)
/reload-plugins
```

After install: `/shapeup:shape "your idea"`, or spawn `shapeup:shaper`. Run `/shapeup:flow-router` to see the full decision tree.

## Update (after pushing changes here)

```
/plugin marketplace update rafo-flow
/reload-plugins
```

`version` is intentionally omitted from `plugin.json`, so each commit counts as a new version.

## Local dev / testing

```
claude plugin validate .
claude --plugin-dir ./plugins/shapeup
```

## Notes

- The `shapeup` agents rely on `exa` + `context7` MCP servers. These are configured at the **user level** (`~/.claude.json`), so they're available in every project automatically. If you share this plugin with someone who doesn't have those servers, the `researcher` agent loses web search — configure them in the consuming project's MCP settings.
- Project-specific agents/skills (anything that reads a specific `docs/VISION.md`, targets a specific language/platform, etc.) stay in that project's `.claude/`, not here.
