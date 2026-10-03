import { escapeAttr, escapeHtml, slugify } from "../html.ts";
import { inlineToText, renderInline } from "./inline.ts";

export interface Heading {
  level: number;
  /** Plain text of the heading (markup stripped). */
  text: string;
  /** The `id` attribute given to the heading element. */
  id: string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

const FENCE = /^(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Renders the supported Markdown subset to HTML: ATX headings, paragraphs,
 * fenced code blocks, flat bullet and numbered lists, plus inline markup.
 * Raw HTML in the source is not passed through; it is escaped like any text.
 */
export function renderMarkdown(source: string): RenderResult {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  const headings: Heading[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] as string;

    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] as string;
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] as string).trim().startsWith(marker)) {
        code.push(lines[i] as string);
        i++;
      }
      i++; // closing fence (or end of input for an unterminated block)
      blocks.push(renderCodeBlock(code.join("\n"), fence[2] as string));
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      const raw = heading[2] as string;
      const text = inlineToText(raw);
      // TODO: two headings with the same text get the same id.
      const id = slugify(text);
      headings.push({ level, text, id });
      blocks.push(`<h${level} id="${escapeAttr(id)}">${renderInline(raw)}</h${level}>`);
      i++;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const list = parseList(lines, i);
      blocks.push(list.html);
      i = list.next;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && (lines[i] as string).trim() !== "" && !startsBlock(lines[i] as string)) {
      para.push((lines[i] as string).trim());
      i++;
    }
    blocks.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return { html: blocks.join("\n"), headings };
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || ORDERED.test(line);
}

function renderCodeBlock(code: string, lang: string): string {
  const cls = lang ? ` class="language-${escapeAttr(lang)}"` : "";
  return `<pre><code${cls}>${escapeHtml(code)}</code></pre>`;
}

function parseList(lines: string[], start: number): { html: string; next: number } {
  const ordered = ORDERED.test(lines[start] as string) && !BULLET.test(lines[start] as string);
  const itemPattern = ordered ? ORDERED : BULLET;
  const items: string[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i] as string;
    const item = itemPattern.exec(line);
    if (item) {
      items.push((item[1] as string).trim());
      i++;
      continue;
    }
    // Indented continuation line belongs to the previous item.
    if (items.length > 0 && /^\s{2,}\S/.test(line) && !startsBlock(line)) {
      items[items.length - 1] += ` ${line.trim()}`;
      i++;
      continue;
    }
    break;
  }

  const tag = ordered ? "ol" : "ul";
  const body = items.map((text) => `<li>${renderInline(text)}</li>`).join("");
  return { html: `<${tag}>${body}</${tag}>`, next: i };
}
