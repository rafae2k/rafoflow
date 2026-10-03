import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { App } from "./app.ts";
import { errorResponse, type AppRequest, type AppResponse } from "./types.ts";

const MAX_BODY_BYTES = 1024 * 1024;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function toAppRequest(req: IncomingMessage, body: string): AppRequest {
  const url = new URL(req.url ?? "/", "http://localhost");
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return { method: req.method ?? "GET", path: url.pathname, query: url.searchParams, headers, body };
}

function send(res: ServerResponse, response: AppResponse): void {
  const isText = typeof response.body === "string";
  const payload = isText ? (response.body as string) : JSON.stringify(response.body);
  res.writeHead(response.status, {
    "content-type": isText ? "text/plain; charset=utf-8" : "application/json",
    ...response.headers,
  });
  res.end(payload);
}

/** Adapts the transport-independent App to node:http. */
export function createHttpServer(app: App, log: (msg: string, err?: unknown) => void = console.error): Server {
  return createServer(async (req, res) => {
    let response: AppResponse;
    try {
      const body = await readBody(req);
      response = await app.handle(toAppRequest(req, body));
    } catch (err) {
      log("unhandled error", err);
      response = errorResponse(500, "internal_error", "internal error");
    }
    send(res, response);
  });
}
