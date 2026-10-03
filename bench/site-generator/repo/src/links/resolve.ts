import path from "node:path";
import { relativeUrl } from "../paths.ts";

const posix = path.posix;

export type LinkResolution =
  | { kind: "external" }
  | { kind: "anchor" }
  | { kind: "asset" }
  | { kind: "page"; href: string; target: string }
  | { kind: "broken"; reason: string };

export interface LinkSource {
  sourcePath: string;
  route: string;
}

/** Source path -> route of every page in the build. */
export type PageIndex = ReadonlyMap<string, string>;

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const MARKDOWN_LINK = /\.md($|[#?])/i;

/**
 * Decides what a link written in `from` points to. Links to other Markdown
 * pages (relative to the current file, or root-relative with a leading "/")
 * are resolved against the page index and turned into relative URLs between
 * output routes. Links to `.md` files that are not in the build are broken.
 */
export function resolveLink(href: string, from: LinkSource, pages: PageIndex): LinkResolution {
  if (href === "" || href.startsWith("#")) return { kind: "anchor" };
  if (SCHEME.test(href) || href.startsWith("//")) return { kind: "external" };
  if (!MARKDOWN_LINK.test(href)) return { kind: "asset" };

  const target = resolveSourcePath(from.sourcePath, href);
  if (target === undefined) return { kind: "broken", reason: "points outside the source directory" };

  const route = pages.get(target);
  if (route === undefined) return { kind: "broken", reason: `no page at ${target}` };
  return { kind: "page", href: relativeUrl(from.route, route), target };
}

/** Resolves a link path against the linking page; undefined if it leaves the source dir. */
export function resolveSourcePath(fromSourcePath: string, linkPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURI(linkPath);
  } catch {
    decoded = linkPath;
  }
  const joined = decoded.startsWith("/")
    ? posix.normalize(decoded.slice(1))
    : posix.normalize(posix.join(posix.dirname(fromSourcePath), decoded));
  if (joined === ".." || joined.startsWith("../")) return undefined;
  return joined;
}
