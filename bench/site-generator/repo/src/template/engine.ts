import { TemplateError } from "../errors.ts";
import { escapeHtml } from "../html.ts";

export type TemplateValue = string | number | boolean | undefined;
export interface TemplateVars {
  [key: string]: TemplateValue | TemplateVars;
}

/** `{{ name }}` (escaped) or `{{{ name }}}` (raw). Names may be dotted: `page.title`. */
const TAG = /\{\{(\{?)\s*([A-Za-z_][\w.]*)\s*(\}?)\}\}/g;

/**
 * Renders a layout. `{{var}}` is HTML-escaped; `{{{var}}}` inserts the value
 * as-is and must only be used for HTML the generator itself produced
 * (rendered content, navigation). Missing variables render as "".
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(TAG, (match: string, open: string, name: string, close: string) => {
    if (open.length !== close.length) throw new TemplateError(`unbalanced braces in ${match}`);
    const value = lookup(vars, name);
    if (value === undefined) return "";
    if (typeof value === "object") throw new TemplateError(`"${name}" is an object, not a value`);
    const text = String(value);
    return open === "{" ? text : escapeHtml(text);
  });
}

/** Variable names a template references, in order of first appearance. */
export function templateVariables(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(TAG)) {
    const name = match[2] as string;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

function lookup(vars: TemplateVars, dotted: string): TemplateValue | TemplateVars {
  let current: TemplateValue | TemplateVars = vars;
  for (const part of dotted.split(".")) {
    if (current === undefined || typeof current !== "object" || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return current;
}
