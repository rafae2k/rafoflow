import { build, type BuildOptions, type BuildResult } from "../src/build.ts";
import { MemoryFs } from "../src/fs/memory-fs.ts";

export const SRC = "/site/content";
export const OUT = "/site/dist";

/** A MemoryFs with `pages` (paths relative to SRC) seeded. */
export function siteFs(pages: Record<string, string>): MemoryFs {
  const files: Record<string, string> = {};
  for (const [rel, content] of Object.entries(pages)) files[`${SRC}/${rel}`] = content;
  return new MemoryFs(files);
}

export async function buildSite(
  pages: Record<string, string>,
  options: Partial<BuildOptions> = {},
): Promise<{ fs: MemoryFs; result: BuildResult; out: (route: string) => Promise<string> }> {
  const fs = siteFs(pages);
  const result = await build({ fs, srcDir: SRC, outDir: OUT, ...options });
  return { fs, result, out: (route) => fs.readFile(`${OUT}/${route}`) };
}
