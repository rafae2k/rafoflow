import { escapeAttr, escapeHtml } from "../html.ts";

/** Characters that can be backslash-escaped to be taken literally. */
const ESCAPABLE = /[\\`*_[\]()#!-]/;

/** URL schemes allowed in links. Anything else (javascript:, data:, ...) is neutralized. */
const ALLOWED_SCHEMES = ["http:", "https:", "mailto:"];

interface LinkMatch {
  label: string;
  href: string;
  end: number;
}

/**
 * Renders inline Markdown (code spans, links, strong, emphasis) to HTML.
 * All text is escaped; the only tags in the output are the ones produced here.
 */
export function renderInline(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.test(src[i + 1] as string)) {
      out += escapeHtml(src[i + 1] as string);
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        out += `<code>${escapeHtml(src.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }

    if (ch === "[") {
      const link = matchLink(src, i);
      if (link) {
        out += `<a href="${escapeAttr(safeHref(link.href))}">${renderInline(link.label)}</a>`;
        i = link.end;
        continue;
      }
    }

    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        out += `<strong>${renderInline(src.slice(i + 2, end))}</strong>`;
        i = end + 2;
        continue;
      }
    }

    // TODO: `_` inside words (snake_case) still opens emphasis; CommonMark does not.
    if ((ch === "*" || ch === "_") && src[i + 1] !== " ") {
      const end = src.indexOf(ch, i + 1);
      if (end > i + 1) {
        out += `<em>${renderInline(src.slice(i + 1, end))}</em>`;
        i = end + 1;
        continue;
      }
    }

    out += escapeHtml(ch);
    i++;
  }
  return out;
}

/** Plain text of inline Markdown: markup removed, code and link labels kept. */
export function inlineToText(src: string): string {
  return src
    .replace(/\\(.)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|\*|_)(.+?)\1/g, "$2")
    .trim();
}

function matchLink(src: string, start: number): LinkMatch | null {
  let depth = 0;
  let close = -1;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]" && --depth === 0) {
      close = j;
      break;
    }
  }
  if (close === -1 || src[close + 1] !== "(") return null;
  const end = src.indexOf(")", close + 2);
  if (end === -1) return null;
  const href = src.slice(close + 2, end).trim();
  if (href === "" || /\s/.test(href)) return null;
  return { label: src.slice(start + 1, close), href, end: end + 1 };
}

function safeHref(href: string): string {
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(href);
  if (scheme && !ALLOWED_SCHEMES.includes((scheme[1] as string).toLowerCase())) return "#";
  return href;
}
