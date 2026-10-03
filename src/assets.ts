import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** Package root: one level above `src/` (dev) or `dist/` (built). */
export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const prompt = (name: string): string => readFileSync(join(PACKAGE_ROOT, "prompts", `${name}.md`), "utf8");
export const schema = (name: string): object => JSON.parse(readFileSync(join(PACKAGE_ROOT, "schemas", `${name}.json`), "utf8"));

export const PACKAGE_VERSION: string = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;

/** Replaces `{{key}}` placeholders. */
export const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
