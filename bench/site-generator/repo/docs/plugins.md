# Plugins

A plugin is an object with a `name` and optional hooks (`Plugin` in `src/plugins/types.ts`). Pass plugins to `build({ plugins: [...] })`; they run in the order given.

```ts
import type { Plugin } from "./src/index.ts";

const wordCount: Plugin = {
  name: "word-count",
  onPage(ctx) {
    ctx.vars.wordCount = String(ctx.page.body.split(/\s+/).length);
  },
};
```

## `onPage(ctx)`

Called once per page, after Markdown rendering and link rewriting, before the layout. `runPageHooks` (`src/plugins/runner.ts`) builds the context:

- `ctx.page` — a **frozen** deep copy of the page: `sourcePath`, `route`, `title`, `order`, `description`, `data` (all front matter), `body` (Markdown) and `headings`. Assigning to it throws.
- `ctx.site` — frozen summaries of every page in the build.
- `ctx.html` — the rendered page HTML. A plugin may replace it. It is inserted into the layout raw, so a plugin must escape anything it adds.
- `ctx.vars` — template variables for this page. They are escaped by `{{name}}` like any other value. The generator's own names (`site`, `page`, `nav`, `content`, `rootUrl`, `buildDate`) are reserved; setting one fails the build with a `PluginError`.

A plugin can never change another page, or the current page's data (AGENTS.md invariant 4).

## `onBuildEnd(ctx)`

Called once after all pages are rendered. `ctx.site` lists the pages; `ctx.emit(path, contents)` adds an extra file to the output (a sitemap, a search index). The path is relative to the output dir and is checked with `resolveOutputPath` (`src/paths.ts`); a path that escapes the output dir fails the build.

## Built-in: reading time

`readingTime({ wordsPerMinute = 200 })` (`src/plugins/reading-time.ts`) sets `readingTime` to e.g. `"3 min read"`, rounding up, minimum 1. Words inside fenced code blocks are not counted (`countWords`). The default layout shows it above the content. The CLI enables it unless `site.json` has `"readingTime": false` or `--no-reading-time` is passed.
