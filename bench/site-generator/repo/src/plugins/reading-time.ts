import { PluginError } from "../errors.ts";
import type { Plugin } from "./types.ts";

export interface ReadingTimeOptions {
  /** Defaults to 200. */
  wordsPerMinute?: number;
}

/**
 * Built-in plugin: sets the `readingTime` template variable ("3 min read")
 * from the page's word count. Fenced code blocks are not counted.
 */
export function readingTime(options: ReadingTimeOptions = {}): Plugin {
  const wpm = options.wordsPerMinute ?? 200;
  if (!Number.isFinite(wpm) || wpm <= 0) throw new PluginError("reading-time", "wordsPerMinute must be a positive number");

  return {
    name: "reading-time",
    onPage(ctx) {
      const minutes = Math.max(1, Math.ceil(countWords(ctx.page.body) / wpm));
      ctx.vars.readingTime = `${minutes} min read`;
    },
  };
}

export function countWords(markdown: string): number {
  const withoutCode = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1\s*$/gm, " ");
  const words = withoutCode.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}
