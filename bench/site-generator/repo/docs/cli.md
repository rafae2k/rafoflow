# CLI and configuration

The CLI lives in `src/cli.ts`; `runCli(argv, io)` does the work and returns the exit code, so it can be tested with `MemoryFs`.

```sh
node src/cli.ts build [--root <dir>] [--src <dir>] [--out <dir>] [--no-reading-time]
node src/cli.ts check [same options]
```

- `build` — full build of the source dir into the output dir (see `docs/architecture.md`). The output dir is replaced on every build.
- `check` — runs the whole pipeline with `dryRun: true`: front matter, links and templates are validated, nothing is written.

Exit codes: `0` success, `1` build error (broken links, bad front matter, ...), `2` usage error.

## `site.json`

Read from `--root` (default: the current directory) by `loadConfig` (`src/config.ts`). All keys are optional; unknown keys are an error.

```json
{
  "title": "Acme Docs",
  "lang": "en",
  "srcDir": "content",
  "outDir": "dist",
  "readingTime": { "wordsPerMinute": 220 }
}
```

`srcDir` and `outDir` are resolved against the root and must be different folders. `readingTime` may also be `false` to disable the plugin.
