/**
 * The narrow file-system surface the generator needs. Production code uses
 * `createNodeFs()`; tests use `MemoryFs`. All paths are POSIX-style.
 */
export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export interface FileSystem {
  readFile(path: string): Promise<string>;
  /** Writes a file. The parent directory must already exist. */
  writeFile(path: string, data: string): Promise<void>;
  /** Lists a directory. Order is unspecified; callers sort. */
  readdir(path: string): Promise<DirEntry[]>;
  /** Creates a directory and any missing parents. No-op if it exists. */
  mkdir(path: string): Promise<void>;
  /** Removes a file or directory tree. No-op if it does not exist. */
  rm(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
