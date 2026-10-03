# site-generator — agent notes

A static documentation-site generator: a folder of Markdown pages with front matter goes in, a folder of HTML pages comes out. It is a library (`src/index.ts`) plus a small CLI (`src/cli.ts`). No runtime dependencies; TypeScript runs directly on Node 22.18+ (type stripping, so only erasable syntax: no `enum`, `namespace`, parameter properties or decorators). Imports use the `.ts` extension.

## Domain in one paragraph

`build()` in `src/build.ts` loads pages (`loadPages`, `src/content/load.ts`), renders each body with our own Markdown subset parser (`renderMarkdown`, `src/markdown/render.ts`), rewrites links between pages and collects broken ones (`rewriteLinks`, `src/links/rewrite.ts`), builds the navigation tree from folders and front-matter `order` (`buildNavTree`, `src/nav/tree.ts`), runs plugins (`runPageHooks`, `src/plugins/runner.ts`), applies the layout with the tiny template engine (`renderTemplate`, `src/template/engine.ts`) and writes every page through the injected `FileSystem` (`src/fs/types.ts`). Tests use `MemoryFs`; production uses `createNodeFs()`.

## Invariants (the code must keep all of them)

1. **Escaping.** Every piece of user content that ends up in HTML is escaped — front matter, page titles, nav labels, link targets, code. The only unescaped HTML is what the Markdown renderer itself produces. In templates `{{var}}` escapes by default; `{{{var}}}` is reserved for generator-produced HTML (`content`, `nav`).
2. **Deterministic builds.** The same input produces byte-identical output: stable ordering everywhere (no reliance on directory listing order or locale), no timestamps or randomness unless injected through `BuildOptions` (e.g. `now`).
3. **Broken links fail loudly.** A link to a page that is not in the build fails the build with a `BrokenLinkError` that lists every broken link (source page and href), and nothing is written. Never skip, drop or silently leave a broken internal link.
4. **Plugin isolation.** During `onPage` a plugin sees a frozen copy of the current page and frozen summaries of the others. It cannot mutate any page's data; it can only return HTML and template variables for the current page.
5. **Output stays inside the output dir.** No output path may escape `outDir` — not through file names, front matter, or plugin-emitted files. All writes go through `resolveOutputPath` (`src/paths.ts`).

## Working here

- `npm test` runs `node --test` over `test/**/*.test.ts`; `npm run typecheck` runs `tsc --noEmit`. Both must stay green.
- Tests are deterministic: in-memory FS, no clock, no network.
- Docs in `docs/` describe behavior and name real code paths. If you change behavior a doc describes, update the doc in the same change.
- Keep modules small and the public API in `src/index.ts` explicit.
