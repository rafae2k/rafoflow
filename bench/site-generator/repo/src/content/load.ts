import path from "node:path";
import type { FileSystem } from "../fs/types.ts";
import { createPage, type Page } from "./page.ts";

const posix = path.posix;

/** Files and folders starting with these characters are never treated as pages. */
const IGNORED_PREFIXES = ["_", "."];

/**
 * Reads every Markdown page under `srcDir`, in a stable order (byte order of
 * the relative path), so builds are deterministic regardless of the order
 * the file system lists entries in.
 */
export async function loadPages(fs: FileSystem, srcDir: string): Promise<Page[]> {
  const files = await listMarkdownFiles(fs, srcDir, "");
  const pages: Page[] = [];
  for (const rel of files) {
    const raw = await fs.readFile(posix.join(srcDir, rel));
    pages.push(createPage(rel, raw));
  }
  return pages;
}

export async function listMarkdownFiles(fs: FileSystem, root: string, rel: string): Promise<string[]> {
  const entries = await fs.readdir(rel === "" ? root : posix.join(root, rel));
  entries.sort((a, b) => compareStrings(a.name, b.name));

  const out: string[] = [];
  for (const entry of entries) {
    if (IGNORED_PREFIXES.some((p) => entry.name.startsWith(p))) continue;
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory) {
      out.push(...(await listMarkdownFiles(fs, root, childRel)));
    } else if (entry.name.endsWith(".md")) {
      out.push(childRel);
    }
  }
  return out;
}

/** Locale-independent string comparison (plain UTF-16 code unit order). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
