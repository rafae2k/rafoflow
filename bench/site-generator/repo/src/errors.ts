/**
 * Error types raised by the generator. Every error carries a stable `code` so
 * the CLI (and callers) can branch on it without parsing messages.
 */

export class SiteError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class FrontMatterError extends SiteError {
  readonly file: string;
  readonly line: number | undefined;

  constructor(file: string, message: string, line?: number) {
    super("FRONT_MATTER", line === undefined ? `${file}: ${message}` : `${file}:${line}: ${message}`);
    this.file = file;
    this.line = line;
  }
}

export class PathError extends SiteError {
  readonly path: string;

  constructor(path: string, message: string) {
    super("UNSAFE_PATH", message);
    this.path = path;
  }
}

export class TemplateError extends SiteError {
  constructor(message: string) {
    super("TEMPLATE", message);
  }
}

export class ConfigError extends SiteError {
  constructor(message: string) {
    super("CONFIG", message);
  }
}

export class PluginError extends SiteError {
  readonly plugin: string;

  constructor(plugin: string, message: string) {
    super("PLUGIN", `plugin "${plugin}": ${message}`);
    this.plugin = plugin;
  }
}

export interface BrokenLink {
  /** Source path of the page containing the link, relative to the source dir. */
  from: string;
  /** The href exactly as the author wrote it. */
  href: string;
  /** Human-readable reason, e.g. "no page at guide/missing.md". */
  reason: string;
}

export class BrokenLinkError extends SiteError {
  readonly links: readonly BrokenLink[];

  constructor(links: readonly BrokenLink[]) {
    const lines = links.map((l) => `  ${l.from} -> ${l.href} (${l.reason})`);
    super("BROKEN_LINKS", `Broken internal links (${links.length}):\n${lines.join("\n")}`);
    this.links = links;
  }
}
