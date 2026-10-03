import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import type { DirEntry, FileSystem } from "./types.ts";

/** FileSystem backed by the real disk via node:fs/promises. */
export function createNodeFs(): FileSystem {
  return {
    async readFile(path: string): Promise<string> {
      return readFile(path, "utf8");
    },
    async writeFile(path: string, data: string): Promise<void> {
      await writeFile(path, data, "utf8");
    },
    async readdir(path: string): Promise<DirEntry[]> {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
    },
    async mkdir(path: string): Promise<void> {
      await mkdir(path, { recursive: true });
    },
    async rm(path: string): Promise<void> {
      await rm(path, { recursive: true, force: true });
    },
    async exists(path: string): Promise<boolean> {
      try {
        await stat(path);
        return true;
      } catch {
        return false;
      }
    },
  };
}
