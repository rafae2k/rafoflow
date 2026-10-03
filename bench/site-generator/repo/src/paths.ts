import path from "node:path";
import { PathError } from "./errors.ts";

const posix = path.posix;

/** Converts a platform path to POSIX separators. */
export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Maps a source file (relative to the source dir, POSIX) to its output route,
 * also relative: "guide/intro.md" -> "guide/intro.html".
 */
export function routeForSource(sourcePath: string): string {
  if (!sourcePath.endsWith(".md")) {
    throw new PathError(sourcePath, `not a Markdown source: ${sourcePath}`);
  }
  return `${sourcePath.slice(0, -".md".length)}.html`;
}

/**
 * Joins a route onto the output directory and guarantees the result stays
 * inside it (invariant 5). Throws PathError otherwise.
 */
export function resolveOutputPath(outDir: string, route: string): string {
  if (route === "" || route.includes("\0")) {
    throw new PathError(route, `invalid output route: ${JSON.stringify(route)}`);
  }
  const normalized = posix.normalize(route);
  if (posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new PathError(route, `output route escapes the output directory: ${route}`);
  }
  const full = posix.join(outDir, normalized);
  const rel = posix.relative(outDir, full);
  if (rel === "" || rel.startsWith("..") || posix.isAbsolute(rel)) {
    throw new PathError(route, `output route escapes the output directory: ${route}`);
  }
  return full;
}

/** Relative URL from one route to another, e.g. ("a/b.html", "c.html") -> "../c.html". */
export function relativeUrl(fromRoute: string, toRoute: string): string {
  const rel = posix.relative(posix.dirname(fromRoute), toRoute);
  return rel === "" ? posix.basename(toRoute) : rel;
}

/** Prefix that leads from a route back to the site root: "" or "../" repeated. */
export function rootPrefix(route: string): string {
  const depth = route.split("/").length - 1;
  return "../".repeat(depth);
}
