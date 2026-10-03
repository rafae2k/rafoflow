import type { Page, PageSummary } from "../content/page.ts";
import { PluginError } from "../errors.ts";
import type { Heading } from "../markdown/render.ts";
import type { PageHookContext, Plugin, PluginPage } from "./types.ts";

/** Template variable names owned by the generator; plugins cannot set them. */
export const RESERVED_VARS: readonly string[] = ["site", "page", "nav", "content", "rootUrl", "buildDate"];

export interface PageHookResult {
  html: string;
  vars: Record<string, string>;
}

/**
 * Runs every plugin's `onPage` for one page, in registration order. Each
 * plugin gets a frozen deep copy of the page, so it cannot change this page's
 * data or any other page's (invariant 4); it can only return HTML and vars.
 */
export async function runPageHooks(
  plugins: readonly Plugin[],
  page: Page,
  headings: readonly Heading[],
  html: string,
  site: readonly PageSummary[],
): Promise<PageHookResult> {
  const vars: Record<string, string> = {};
  let current = html;

  for (const plugin of plugins) {
    if (!plugin.onPage) continue;
    const ctx: PageHookContext = {
      page: deepFreeze(toPluginPage(page, headings)),
      site,
      html: current,
      vars,
    };
    try {
      await plugin.onPage(ctx);
    } catch (err) {
      if (err instanceof PluginError) throw err;
      throw new PluginError(plugin.name, `onPage failed for ${page.sourcePath}: ${(err as Error).message}`);
    }
    if (typeof ctx.html !== "string") throw new PluginError(plugin.name, "ctx.html must be a string");
    current = ctx.html;
  }

  for (const [key, value] of Object.entries(vars)) {
    if (RESERVED_VARS.includes(key)) throw new PluginError("?", `template variable "${key}" is reserved`);
    if (typeof value !== "string") throw new PluginError("?", `template variable "${key}" must be a string`);
  }
  return { html: current, vars };
}

function toPluginPage(page: Page, headings: readonly Heading[]): PluginPage {
  return structuredClone({
    sourcePath: page.sourcePath,
    route: page.route,
    title: page.title,
    order: page.order,
    description: page.description,
    data: page.data,
    body: page.body,
    headings: [...headings],
  });
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
