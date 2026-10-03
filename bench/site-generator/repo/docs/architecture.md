# Architecture

The generator is a single pipeline in `build()` (`src/build.ts`). Every build is a **full build**: all pages are loaded, rendered and written, and the output dir is wiped first so files from earlier builds never survive.

## Pipeline

1. **Load** — `loadPages(fs, srcDir)` (`src/content/load.ts`) walks the source dir in byte order of file names and calls `createPage` (`src/content/page.ts`) for each `.md` file. Drafts are dropped.
2. **Render** — `renderMarkdown(page.body)` (`src/markdown/render.ts`) returns the HTML and the list of headings.
3. **Links** — `rewriteLinks(html, page, index)` (`src/links/rewrite.ts`) rewrites links to other pages and returns the broken ones plus `linksTo`, the pages this page links to. After all pages are rendered, any broken link throws `BrokenLinkError` (`src/errors.ts`) before anything is written.
4. **Navigation** — `buildNavTree(summaries)` (`src/nav/tree.ts`) builds one tree for the whole site; `renderNav(tree, route)` renders it per page with links relative to that page. Every page's HTML therefore depends on the titles, orders and paths of all pages.
5. **Plugins** — `runPageHooks` (`src/plugins/runner.ts`) runs each plugin's `onPage` with a frozen copy of the page. Then `onBuildEnd` hooks may `emit` extra files.
6. **Layout** — `renderTemplate(layout, vars)` (`src/template/engine.ts`) fills the layout.
7. **Write** — the output dir is removed and recreated, then each file is written, in sorted order, to `resolveOutputPath(outDir, route)` (`src/paths.ts`), which rejects any path that would leave the output dir.

With `dryRun: true` the build stops before step 7; the CLI's `check` command uses this.

## File system

All I/O goes through the `FileSystem` interface (`src/fs/types.ts`). `createNodeFs()` (`src/fs/node-fs.ts`) wraps `node:fs/promises`; `MemoryFs` (`src/fs/memory-fs.ts`) keeps files in a map and is what the tests use.

## Determinism

Output is a pure function of the input files and `BuildOptions`. Ordering never depends on directory listing order or locale (`compareStrings` in `src/content/load.ts`), and the build never reads the clock: `{{buildDate}}` is only filled when `now` is passed in.

## Errors

All errors extend `SiteError` with a stable `code`: `FRONT_MATTER`, `UNSAFE_PATH`, `TEMPLATE`, `CONFIG`, `PLUGIN`, `BROKEN_LINKS`. The CLI prints `error [CODE]: message` and exits with 1 (2 for usage errors).
