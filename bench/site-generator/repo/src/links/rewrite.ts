import type { BrokenLink } from "../errors.ts";
import { escapeAttr, unescapeHtml } from "../html.ts";
import { type LinkSource, type PageIndex, resolveLink } from "./resolve.ts";

export interface RewriteResult {
  html: string;
  broken: BrokenLink[];
  /** Source paths of the pages this page links to, sorted, without duplicates. */
  linksTo: string[];
}

const HREF = /href="([^"]*)"/g;

/**
 * Rewrites `href`s in rendered page HTML: links to other Markdown pages become
 * relative URLs to their output files. Broken internal links are collected,
 * never dropped; the caller decides how to fail (see BrokenLinkError).
 */
export function rewriteLinks(html: string, from: LinkSource, pages: PageIndex): RewriteResult {
  const broken: BrokenLink[] = [];
  const linksTo = new Set<string>();

  const out = html.replace(HREF, (match: string, encoded: string) => {
    const href = unescapeHtml(encoded);
    const result = resolveLink(href, from, pages);
    if (result.kind === "broken") {
      broken.push({ from: from.sourcePath, href, reason: result.reason });
      return match;
    }
    if (result.kind !== "page") return match;
    linksTo.add(result.target);
    return `href="${escapeAttr(result.href)}"`;
  });

  return { html: out, broken, linksTo: [...linksTo].sort() };
}
