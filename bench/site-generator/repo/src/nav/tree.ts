import path from "node:path";
import { humanize, type PageSummary } from "../content/page.ts";
import { compareStrings } from "../content/load.ts";
import { escapeAttr, escapeHtml } from "../html.ts";
import { relativeUrl } from "../paths.ts";

const posix = path.posix;

export interface NavNode {
  /** Folder path or source path; unique, used as the last sort key. */
  key: string;
  title: string;
  /** Route of the page this node links to; undefined for folders without index.md. */
  route: string | undefined;
  order: number | undefined;
  children: NavNode[];
}

/**
 * Builds the navigation tree from folder structure. A folder's `index.md`
 * gives the folder its title, link and order. Siblings are sorted by
 * `order` (unordered last), then title, then key.
 */
export function buildNavTree(pages: readonly PageSummary[]): NavNode {
  const root: NavNode = { key: "", title: "", route: undefined, order: undefined, children: [] };
  const folders = new Map<string, NavNode>([["", root]]);

  const folderFor = (dir: string): NavNode => {
    const existing = folders.get(dir);
    if (existing) return existing;
    const parentDir = posix.dirname(dir);
    const parent = folderFor(parentDir === "." ? "" : parentDir);
    const node: NavNode = { key: dir, title: humanize(posix.basename(dir)), route: undefined, order: undefined, children: [] };
    parent.children.push(node);
    folders.set(dir, node);
    return node;
  };

  for (const page of pages) {
    const dir = posix.dirname(page.sourcePath);
    const isFolderIndex = posix.basename(page.sourcePath) === "index.md" && dir !== ".";
    if (isFolderIndex) {
      const folder = folderFor(dir);
      folder.title = page.title;
      folder.route = page.route;
      folder.order = page.order;
    } else {
      const parent = folderFor(dir === "." ? "" : dir);
      parent.children.push({ key: page.sourcePath, title: page.title, route: page.route, order: page.order, children: [] });
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: NavNode): void {
  node.children.sort(compareNodes);
  for (const child of node.children) sortTree(child);
}

function compareNodes(a: NavNode, b: NavNode): number {
  if (a.order !== b.order) {
    if (a.order === undefined) return 1;
    if (b.order === undefined) return -1;
    return a.order - b.order;
  }
  return compareStrings(a.title, b.title) || compareStrings(a.key, b.key);
}

/** Renders the tree as nested lists, with links relative to `currentRoute`. */
export function renderNav(root: NavNode, currentRoute: string): string {
  return `<nav class="site-nav">${renderList(root.children, currentRoute)}</nav>`;
}

function renderList(nodes: readonly NavNode[], currentRoute: string): string {
  if (nodes.length === 0) return "";
  const items = nodes.map((node) => {
    const label = escapeHtml(node.title);
    const head =
      node.route === undefined
        ? `<span>${label}</span>`
        : `<a href="${escapeAttr(relativeUrl(currentRoute, node.route))}"${node.route === currentRoute ? ' aria-current="page"' : ""}>${label}</a>`;
    return `<li>${head}${renderList(node.children, currentRoute)}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}
