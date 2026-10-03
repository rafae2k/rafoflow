import path from "node:path";
import { loadPages } from "./content/load.ts";
import { type Page, type PageSummary, toSummary } from "./content/page.ts";
import { BrokenLinkError, type BrokenLink } from "./errors.ts";
import type { FileSystem } from "./fs/types.ts";
import { rewriteLinks } from "./links/rewrite.ts";
import { type Heading, renderMarkdown } from "./markdown/render.ts";
import { buildNavTree, renderNav } from "./nav/tree.ts";
import { resolveOutputPath, rootPrefix } from "./paths.ts";
import { deepFreeze, runPageHooks } from "./plugins/runner.ts";
import type { Plugin } from "./plugins/types.ts";
import { DEFAULT_LAYOUT, LAYOUT_FILE } from "./template/default-layout.ts";
import { renderTemplate, type TemplateVars } from "./template/engine.ts";

const posix = path.posix;

export interface SiteInfo {
  title: string;
  lang: string;
}

export interface BuildOptions {
  fs: FileSystem;
  srcDir: string;
  outDir: string;
  site?: Partial<SiteInfo>;
  /** Layout template; defaults to `<srcDir>/_layout.html`, then DEFAULT_LAYOUT. */
  layout?: string;
  plugins?: readonly Plugin[];
  /** Only used to fill `{{buildDate}}`. Builds never read the clock themselves. */
  now?: Date;
  /** Validate everything (front matter, links, templates) but write nothing. */
  dryRun?: boolean;
}

export interface BuildResult {
  pages: readonly PageSummary[];
  /** Files written, relative to outDir, sorted. Empty for a dry run. */
  written: string[];
}

interface RenderedPage {
  page: Page;
  html: string;
  headings: Heading[];
}

/**
 * Full build: load pages, render Markdown, rewrite and check links, then
 * apply plugins and the layout and write every page. Nothing is written if
 * any link is broken. The output dir is wiped first so stale files never
 * survive (output = f(input)).
 */
export async function build(options: BuildOptions): Promise<BuildResult> {
  const { fs, srcDir, outDir } = options;
  const site: SiteInfo = { title: "Documentation", lang: "en", ...options.site };
  const plugins = options.plugins ?? [];
  const layout = options.layout ?? (await loadLayout(fs, srcDir));

  const pages = (await loadPages(fs, srcDir)).filter((p) => !p.draft);
  const index = new Map(pages.map((p) => [p.sourcePath, p.route]));

  const rendered: RenderedPage[] = [];
  const broken: BrokenLink[] = [];
  for (const page of pages) {
    const md = renderMarkdown(page.body);
    const linked = rewriteLinks(md.html, page, index);
    broken.push(...linked.broken);
    rendered.push({ page, html: linked.html, headings: md.headings });
  }
  if (broken.length > 0) throw new BrokenLinkError(broken);

  const summaries = deepFreeze(pages.map(toSummary));
  const nav = buildNavTree(summaries);

  const outputs = new Map<string, string>();
  for (const { page, html, headings } of rendered) {
    const hooked = await runPageHooks(plugins, page, headings, html, summaries);
    const vars: TemplateVars = {
      ...hooked.vars,
      site: { title: site.title, lang: site.lang },
      page: { title: page.title, description: page.description, route: page.route, sourcePath: page.sourcePath },
      rootUrl: rootPrefix(page.route),
      nav: renderNav(nav, page.route),
      content: hooked.html,
      buildDate: options.now ? options.now.toISOString().slice(0, 10) : undefined,
    };
    outputs.set(page.route, renderTemplate(layout, vars));
  }

  for (const plugin of plugins) {
    if (!plugin.onBuildEnd) continue;
    await plugin.onBuildEnd({
      site: summaries,
      emit(relativePath, contents) {
        resolveOutputPath(outDir, relativePath); // validate early, throws PathError
        outputs.set(posix.normalize(relativePath), contents);
      },
    });
  }

  if (options.dryRun) return { pages: summaries, written: [] };

  await fs.rm(outDir);
  await fs.mkdir(outDir);
  const written: string[] = [];
  for (const [route, contents] of [...outputs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const target = resolveOutputPath(outDir, route);
    await fs.mkdir(posix.dirname(target));
    await fs.writeFile(target, contents);
    written.push(route);
  }
  return { pages: summaries, written };
}

async function loadLayout(fs: FileSystem, srcDir: string): Promise<string> {
  const file = posix.join(srcDir, LAYOUT_FILE);
  return (await fs.exists(file)) ? fs.readFile(file) : DEFAULT_LAYOUT;
}
