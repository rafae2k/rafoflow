import { FrontMatterError } from "../errors.ts";

export type FrontMatterValue = string | number | boolean | string[];
export type FrontMatter = Record<string, FrontMatterValue>;

export interface ParsedSource {
  data: FrontMatter;
  body: string;
}

const KEY_LINE = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/;

/**
 * Splits a Markdown source into front matter and body. Supports a flat YAML
 * subset: `key: value` with strings (bare or quoted), numbers, booleans and
 * inline lists (`[a, b]`). Nested maps are not supported.
 */
export function parseFrontMatter(source: string, file = "<input>"): ParsedSource {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { data: {}, body: text };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) throw new FrontMatterError(file, "front matter is not closed with ---", 1);

  const data: FrontMatter = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i] as string;
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const match = KEY_LINE.exec(line);
    if (!match) throw new FrontMatterError(file, `expected "key: value", got ${JSON.stringify(line)}`, i + 1);
    const key = match[1] as string;
    if (Object.hasOwn(data, key)) throw new FrontMatterError(file, `duplicate key "${key}"`, i + 1);
    data[key] = parseValue(match[2] as string);
  }
  return { data, body: lines.slice(end + 1).join("\n") };
}

function parseValue(raw: string): FrontMatterValue {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => unquote(item.trim()));
  }
  if (isQuoted(v)) return unquote(v);
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function isQuoted(v: string): boolean {
  return v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")));
}

function unquote(v: string): string {
  if (!isQuoted(v)) return v;
  const inner = v.slice(1, -1);
  return v.startsWith('"') ? inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\") : inner.replace(/''/g, "'");
}
