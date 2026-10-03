# Authoring pages

Every `.md` file under the source dir (default `content/`) becomes one HTML page at the same relative path: `content/guide/install.md` → `dist/guide/install.html`. Files and folders whose names start with `_` or `.` are ignored (`_layout.html` lives there). Pages are discovered by `loadPages` in `src/content/load.ts` and turned into `Page` objects by `createPage` in `src/content/page.ts`.

## Front matter

Optional, between `---` lines at the top of the file. A flat YAML subset parsed by `parseFrontMatter` (`src/content/frontmatter.ts`): strings (bare or quoted), numbers, `true`/`false` and inline lists.

```md
---
title: Installing
order: 2
description: How to install the tool
---
```

| Key | Type | Meaning |
| --- | --- | --- |
| `title` | string | Page title. Falls back to the first `# heading`, then the file name. |
| `order` | number | Position among siblings in the navigation. Pages without it come after ordered ones. |
| `description` | string | Goes into `<meta name="description">`. |
| `draft` | boolean | `true` leaves the page out of the build. Links to a draft are broken links. |

Any other key is kept in `page.data` for plugins. All values are escaped when they reach HTML.

## Markdown subset

`renderMarkdown` (`src/markdown/render.ts`) supports:

- ATX headings `#` to `######`. Each heading gets an `id` made by `slugify` (`src/html.ts`) from its text, e.g. `## Getting started` → `id="getting-started"`.
- Paragraphs (consecutive lines are joined).
- Fenced code blocks with ` ``` ` or `~~~` and an optional language (`class="language-ts"`).
- Flat bullet (`-`, `*`, `+`) and numbered (`1.`) lists; indented lines continue the previous item.
- Inline: `` `code` ``, `**strong**`, `*emphasis*` / `_emphasis_`, `[links](target)`, backslash escapes. Rendered by `renderInline` (`src/markdown/inline.ts`).

Raw HTML is **not** passed through: `<div>` in a page shows up as text. Links with schemes other than `http:`, `https:` and `mailto:` are replaced by `#`.

## Links between pages

Link to other pages by their Markdown source path, relative to the current file — `[Install](install.md)`, `[Home](../index.md)` — or root-relative with a leading `/` (`[Home](/index.md)`). `rewriteLinks` (`src/links/rewrite.ts`) turns these into relative links between the output files, using `resolveLink` (`src/links/resolve.ts`). To point at a section of another page, add the heading's id: `[Requirements](install.md#requirements)`.

Links to `.md` files that are not part of the build fail the build with a `BrokenLinkError` listing every broken link. External links, `#anchor` links on the same page and links to other files (images, downloads) are left as written.

## Navigation

The navigation tree mirrors the folder structure (`buildNavTree`, `src/nav/tree.ts`). A folder's `index.md` provides the folder's title, link and `order`; a folder without one is shown as a plain label named after the folder. Siblings are sorted by `order`, then title.

## Layout

Pages are wrapped in `_layout.html` from the source dir if present, otherwise in `DEFAULT_LAYOUT` (`src/template/default-layout.ts`). Templates use `{{name}}` for escaped values and `{{{name}}}` for generator-produced HTML. Available variables: `site.title`, `site.lang`, `page.title`, `page.description`, `page.route`, `page.sourcePath`, `rootUrl`, `nav` (raw), `content` (raw), `buildDate` (only when a date is injected) and plugin variables such as `readingTime`.
