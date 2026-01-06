import type { Handler, RouteParams } from "./route.ts";
import { parseCookies } from "./internal/cookies.ts";
import { resolveRequestId } from "./internal/request_id.ts";

interface CompiledRoute {
  handler: Handler;
  pattern: URLPattern;
}

export interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}

export function createRouter(handlers: Handler[]) {
  const routes: CompiledRoute[] = handlers.map((h) => ({
    handler: h,
    pattern: new URLPattern({ pathname: h.path }),
  }));

  const match = (method: string, url: string): RouteMatch | null => {
    for (const route of routes) {
      // Match if the route method is "*" (all methods) or exactly matches the request method
      if (route.handler.method !== "*" && route.handler.method !== method) {
        continue;
      }

      const result = route.pattern.exec(url);
      if (result) {
        const params: RouteParams = {};
        const groups = result.pathname.groups;
        for (const key in groups) {
          params[key] = groups[key];
        }
        return { handler: route.handler, params };
      }
    }
    return null;
  };

  return {
    match,
    handle: (req: Request): Response | Promise<Response> => {
      const matched = match(req.method, req.url);
      if (!matched) {
        return new Response("Not Found", { status: 404 });
      }

      const requestId = resolveRequestId(req.headers);
      const cookies = parseCookies(req.headers.get("cookie"));

      return matched.handler.handler({
        request: req,
        requestId,
        params: matched.params,
        cookies,
      });
    },
  };
}
