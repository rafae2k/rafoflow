# site-generator

A small static documentation-site generator. Write Markdown pages in a folder, get a navigable HTML site.

```sh
node src/cli.ts build          # reads site.json, builds content/ into dist/
node src/cli.ts check          # validates pages and links, writes nothing
```

As a library:

```ts
import { build, createNodeFs, readingTime } from "./src/index.ts";

await build({
  fs: createNodeFs(),
  srcDir: "content",
  outDir: "dist",
  plugins: [readingTime()],
});
```

## Docs

- [Authoring pages](docs/authoring.md) — front matter, Markdown subset, links, navigation
- [Architecture](docs/architecture.md) — the build pipeline and where each step lives
- [Plugins](docs/plugins.md) — the plugin interface and the built-in reading-time plugin
- [CLI and configuration](docs/cli.md) — commands, flags and `site.json`

## Development

```sh
npm install
npm test
npm run typecheck
```

Requires Node 22.18+. See `AGENTS.md` for the invariants the code keeps.
