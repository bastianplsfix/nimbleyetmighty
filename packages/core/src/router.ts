import type { Handler } from "./route.ts";

export function createRouter(handlers: Handler[]) {
  const match = (method: string, path: string): Handler | null => {
    for (const h of handlers) {
      if (h.method === method && h.path === path) return h;
    }
    return null;
  };

  return {
    match,
    handle: (req: Request): Response | Promise<Response> => {
      const url = new URL(req.url);
      const handler = match(req.method, url.pathname);
      return handler
        ? handler.handler(req)
        : new Response("Not Found", { status: 404 });
    },
  };
}
