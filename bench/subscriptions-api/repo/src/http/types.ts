/** Transport-independent request, built by server.ts from node:http. */
export interface AppRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  /** Raw request body; empty string when there is none. */
  body: string;
}

export interface AppResponse {
  status: number;
  headers?: Record<string, string>;
  /** Objects are serialized as JSON; strings are sent as-is. */
  body: unknown;
}

export interface RouteContext {
  req: AppRequest;
  params: Record<string, string>;
}

export type Handler = (ctx: RouteContext) => AppResponse | Promise<AppResponse>;

export function json(status: number, body: unknown): AppResponse {
  return { status, body };
}

export function errorResponse(status: number, code: string, message: string, details?: unknown): AppResponse {
  return { status, body: { error: { code, message, ...(details === undefined ? {} : { details }) } } };
}
