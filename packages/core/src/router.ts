// router.ts

import type { Handler, RouteParams } from "./route.ts";

interface CompiledRoute {
  handler: Handler;
  pattern: URLPattern;
}

export interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}

// Parse cookies from the Cookie header into an object
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...val] = c.trim().split("=");
      return [key, val.join("=")];
    }),
  );
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

      // Build the context object for the handler
      const url = new URL(req.url);
      const cookies = parseCookies(req.headers.get("cookie"));

      return matched.handler.handler({
        request: req,
        params: matched.params,
        url,
        cookies,
      });
    },
  };
}
