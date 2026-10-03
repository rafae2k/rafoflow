#!/usr/bin/env node
import { build } from "./build.ts";
import { loadConfig, type SiteConfig } from "./config.ts";
import { SiteError } from "./errors.ts";
import { createNodeFs } from "./fs/node-fs.ts";
import type { FileSystem } from "./fs/types.ts";
import { readingTime } from "./plugins/reading-time.ts";
import type { Plugin } from "./plugins/types.ts";

export interface CliIo {
  fs: FileSystem;
  cwd: string;
  stdout(line: string): void;
  stderr(line: string): void;
}

interface CliArgs {
  command: "build" | "check" | "help";
  flags: Map<string, string | true>;
}

const USAGE = `Usage: site-generator <command> [options]

Commands:
  build     Build the site into the output dir
  check     Validate pages and links without writing anything

Options:
  --root <dir>        Project folder containing site.json (default: cwd)
  --src <dir>         Override the source dir
  --out <dir>         Override the output dir
  --no-reading-time   Disable the reading-time plugin
`;

const VALUE_FLAGS = ["root", "src", "out"];
const BOOLEAN_FLAGS = ["no-reading-time"];

export function parseArgs(argv: readonly string[]): CliArgs {
  const [command = "help", ...rest] = argv;
  if (command !== "build" && command !== "check" && command !== "help" && command !== "--help") {
    throw new SiteError("USAGE", `unknown command "${command}"`);
  }
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string;
    if (!arg.startsWith("--")) throw new SiteError("USAGE", `unexpected argument "${arg}"`);
    const name = arg.slice(2);
    if (BOOLEAN_FLAGS.includes(name)) {
      flags.set(name, true);
    } else if (VALUE_FLAGS.includes(name)) {
      const value = rest[++i];
      if (value === undefined || value.startsWith("--")) throw new SiteError("USAGE", `--${name} needs a value`);
      flags.set(name, value);
    } else {
      throw new SiteError("USAGE", `unknown option "${arg}"`);
    }
  }
  return { command: command === "--help" ? "help" : command, flags };
}

export function pluginsFor(config: SiteConfig, args: CliArgs): Plugin[] {
  const plugins: Plugin[] = [];
  if (config.readingTime.enabled && !args.flags.has("no-reading-time")) {
    plugins.push(readingTime({ wordsPerMinute: config.readingTime.wordsPerMinute }));
  }
  return plugins;
}

/** Runs the CLI and returns the process exit code. Never calls process.exit itself. */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  try {
    const args = parseArgs(argv);
    if (args.command === "help") {
      io.stdout(USAGE);
      return 0;
    }
    const root = (args.flags.get("root") as string | undefined) ?? io.cwd;
    const config = await loadConfig(io.fs, root);
    const srcDir = (args.flags.get("src") as string | undefined) ?? config.srcDir;
    const outDir = (args.flags.get("out") as string | undefined) ?? config.outDir;

    const result = await build({
      fs: io.fs,
      srcDir,
      outDir,
      site: { title: config.title, lang: config.lang },
      plugins: pluginsFor(config, args),
      dryRun: args.command === "check",
    });

    if (args.command === "check") io.stdout(`ok: ${result.pages.length} pages, no broken links`);
    else io.stdout(`built ${result.pages.length} pages into ${outDir}`);
    return 0;
  } catch (err) {
    if (err instanceof SiteError) {
      io.stderr(`error [${err.code}]: ${err.message}`);
      return err.code === "USAGE" ? 2 : 1;
    }
    throw err;
  }
}

if (import.meta.filename === process.argv[1]) {
  const code = await runCli(process.argv.slice(2), {
    fs: createNodeFs(),
    cwd: process.cwd(),
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
  process.exitCode = code;
}
