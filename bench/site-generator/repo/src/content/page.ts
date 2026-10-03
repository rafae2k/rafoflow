import path from "node:path";
import { FrontMatterError } from "../errors.ts";
import { routeForSource } from "../paths.ts";
import { type FrontMatter, parseFrontMatter } from "./frontmatter.ts";

export interface Page {
  /** Path relative to the source dir, POSIX, e.g. "guide/install.md". */
  sourcePath: string;
  /** Output path relative to the output dir, e.g. "guide/install.html". */
  route: string;
  title: string;
  /** Navigation order from front matter; pages without it sort after ordered ones. */
  order: number | undefined;
  draft: boolean;
  description: string | undefined;
  data: FrontMatter;
  /** Markdown body without the front matter. */
  body: string;
}

/** A read-only view of a page shared with plugins and templates. */
export interface PageSummary {
  sourcePath: string;
  route: string;
  title: string;
  order: number | undefined;
}

export function createPage(sourcePath: string, raw: string): Page {
  const { data, body } = parseFrontMatter(raw, sourcePath);

  if (data.order !== undefined && typeof data.order !== "number") {
    throw new FrontMatterError(sourcePath, `"order" must be a number`);
  }
  if (data.draft !== undefined && typeof data.draft !== "boolean") {
    throw new FrontMatterError(sourcePath, `"draft" must be true or false`);
  }
  if (data.title !== undefined && typeof data.title !== "string") {
    throw new FrontMatterError(sourcePath, `"title" must be a string`);
  }

  const title = (typeof data.title === "string" && data.title.trim()) || titleFromBody(body) || titleFromFileName(sourcePath);

  return {
    sourcePath,
    route: routeForSource(sourcePath),
    title,
    order: typeof data.order === "number" ? data.order : undefined,
    draft: data.draft === true,
    description: typeof data.description === "string" ? data.description : undefined,
    data,
    body,
  };
}

export function toSummary(page: Page): PageSummary {
  return { sourcePath: page.sourcePath, route: page.route, title: page.title, order: page.order };
}

function titleFromBody(body: string): string | undefined {
  const match = /^#\s+(.+?)\s*$/m.exec(body);
  // TODO: strip inline markup (`code`, *emphasis*) from the derived title.
  return match?.[1];
}

function titleFromFileName(sourcePath: string): string {
  const base = path.posix.basename(sourcePath, ".md");
  const name = base === "index" ? path.posix.basename(path.posix.dirname(sourcePath)) : base;
  return humanize(name === "." ? "home" : name);
}

export function humanize(name: string): string {
  const words = name.replace(/^\d+[-_]/, "").replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
