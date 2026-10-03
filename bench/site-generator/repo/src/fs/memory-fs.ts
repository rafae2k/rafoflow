import path from "node:path";
import type { DirEntry, FileSystem } from "./types.ts";

const posix = path.posix;

function fsError(code: string, message: string): Error {
  const err = new Error(`${code}: ${message}`) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * In-memory FileSystem used by tests. Paths are normalized to absolute POSIX
 * paths, so "out/a.html" and "/out/a.html" are the same file.
 */
export class MemoryFs implements FileSystem {
  readonly #files = new Map<string, string>();
  readonly #dirs = new Set<string>(["/"]);

  constructor(initial: Record<string, string> = {}) {
    for (const [file, content] of Object.entries(initial)) {
      const p = MemoryFs.normalize(file);
      this.#addDirs(posix.dirname(p));
      this.#files.set(p, content);
    }
  }

  static normalize(p: string): string {
    return posix.resolve("/", p);
  }

  async readFile(p: string): Promise<string> {
    const content = this.#files.get(MemoryFs.normalize(p));
    if (content === undefined) throw fsError("ENOENT", `no such file: ${p}`);
    return content;
  }

  async writeFile(p: string, data: string): Promise<void> {
    const n = MemoryFs.normalize(p);
    if (!this.#dirs.has(posix.dirname(n))) throw fsError("ENOENT", `parent directory missing: ${p}`);
    if (this.#dirs.has(n)) throw fsError("EISDIR", `is a directory: ${p}`);
    this.#files.set(n, data);
  }

  async readdir(p: string): Promise<DirEntry[]> {
    const n = MemoryFs.normalize(p);
    if (!this.#dirs.has(n)) throw fsError("ENOENT", `no such directory: ${p}`);
    const prefix = n === "/" ? "/" : `${n}/`;
    const children = new Map<string, boolean>();
    for (const dir of this.#dirs) {
      if (dir !== n && dir.startsWith(prefix) && !dir.slice(prefix.length).includes("/")) {
        children.set(dir.slice(prefix.length), true);
      }
    }
    for (const file of this.#files.keys()) {
      if (file.startsWith(prefix) && !file.slice(prefix.length).includes("/")) {
        children.set(file.slice(prefix.length), false);
      }
    }
    return [...children].map(([name, isDirectory]) => ({ name, isDirectory }));
  }

  async mkdir(p: string): Promise<void> {
    const n = MemoryFs.normalize(p);
    if (this.#files.has(n)) throw fsError("EEXIST", `file exists: ${p}`);
    this.#addDirs(n);
  }

  async rm(p: string): Promise<void> {
    const n = MemoryFs.normalize(p);
    const prefix = `${n}/`;
    this.#files.delete(n);
    for (const file of [...this.#files.keys()]) if (file.startsWith(prefix)) this.#files.delete(file);
    if (n === "/") return;
    this.#dirs.delete(n);
    for (const dir of [...this.#dirs]) if (dir.startsWith(prefix)) this.#dirs.delete(dir);
  }

  async exists(p: string): Promise<boolean> {
    const n = MemoryFs.normalize(p);
    return this.#files.has(n) || this.#dirs.has(n);
  }

  /** All files under `root` (default: everything), keyed by absolute path, sorted. */
  snapshot(root = "/"): Record<string, string> {
    const n = MemoryFs.normalize(root);
    const prefix = n === "/" ? "/" : `${n}/`;
    const keys = [...this.#files.keys()].filter((k) => k.startsWith(prefix)).sort();
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = this.#files.get(k) as string;
    return out;
  }

  #addDirs(dir: string): void {
    let current = dir;
    while (!this.#dirs.has(current)) {
      this.#dirs.add(current);
      current = posix.dirname(current);
    }
  }
}
