import type { Handler } from "./types.ts";

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export type RouteMatch =
  | { kind: "found"; handler: Handler; params: Record<string, string> }
  | { kind: "method_not_allowed"; allowed: string[] }
  | { kind: "not_found" };

function split(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

/** Minimal router: exact segments and `:param` placeholders, no wildcards. */
export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method: method.toUpperCase(), segments: split(pattern), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.add("GET", pattern, handler);
  }

  post(pattern: string, handler: Handler): this {
    return this.add("POST", pattern, handler);
  }

  match(method: string, path: string): RouteMatch {
    const parts = split(path);
    const allowed: string[] = [];
    for (const route of this.routes) {
      const params = matchSegments(route.segments, parts);
      if (!params) continue;
      if (route.method === method.toUpperCase()) return { kind: "found", handler: route.handler, params };
      allowed.push(route.method);
    }
    return allowed.length > 0 ? { kind: "method_not_allowed", allowed } : { kind: "not_found" };
  }
}

function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  if (pattern.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i] as string;
    const value = parts[i] as string;
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(value);
    else if (p !== value) return null;
  }
  return params;
}
