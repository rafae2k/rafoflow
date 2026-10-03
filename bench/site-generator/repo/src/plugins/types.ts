import type { FrontMatter } from "../content/frontmatter.ts";
import type { PageSummary } from "../content/page.ts";
import type { Heading } from "../markdown/render.ts";

/** The page as a plugin sees it during `onPage`: a frozen copy. */
export interface PluginPage extends PageSummary {
  description: string | undefined;
  data: Readonly<FrontMatter>;
  body: string;
  headings: readonly Heading[];
}

export interface PageHookContext {
  /** Frozen copy of the current page. Mutating it throws. */
  readonly page: Readonly<PluginPage>;
  /** Frozen summaries of every page in the build, in build order. */
  readonly site: readonly PageSummary[];
  /** Rendered page HTML. Plugins may replace it; it is inserted raw, so plugins must escape what they add. */
  html: string;
  /** Extra template variables for this page. Values are escaped by `{{var}}` like any other. */
  readonly vars: Record<string, string>;
}

export interface BuildEndContext {
  readonly site: readonly PageSummary[];
  /** Writes an extra file into the output dir (e.g. a sitemap). The path is relative and must stay inside it. */
  emit(relativePath: string, contents: string): void;
}

export interface Plugin {
  name: string;
  onPage?(ctx: PageHookContext): void | Promise<void>;
  onBuildEnd?(ctx: BuildEndContext): void | Promise<void>;
}
