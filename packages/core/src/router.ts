import type { Handler, RouteParams } from "./route.ts";
import { parseCookies } from "./cookies.ts";
import {
  parseBody,
  parseQuery,
  validateInputs,
} from "./internal/validation.ts";

interface CompiledRoute {
  handler: Handler;
  pattern: URLPattern;
}

export interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}

export interface Router {
  match: (method: string, url: string) => RouteMatch | null;
  handle: (
    req: Request,
    initialLocals?: Record<string, unknown>,
  ) => Promise<Response>;
}

export function createRouter(handlers: Handler[]): Router {
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
    handle: async (
      req: Request,
      initialLocals: Record<string, unknown> = {},
    ): Promise<Response> => {
      const matched = match(req.method, req.url);
      if (!matched) {
        return new Response("Not Found", { status: 404 });
      }

      // Extract raw values
      const cookies = parseCookies(req.headers.get("cookie"));
      const query = parseQuery(req.url);

      // Only parse body if a body schema is defined
      const body = matched.handler.request?.body
        ? await parseBody(req)
        : undefined;

      // Perform validation if schemas are defined
      const input = validateInputs(
        matched.handler.request,
        {
          params: matched.params,
          query,
          body,
        },
      );

      const context = {
        req,
        raw: {
          params: matched.params,
          query,
          cookies,
          body,
        },
        input,
        locals: { ...initialLocals },
      };

      // Execute guards in order
      if (matched.handler.guards && matched.handler.guards.length > 0) {
        for (const guard of matched.handler.guards) {
          const guardResult = await guard(context);
          if ("deny" in guardResult) {
            // Guard denied the request, return the denial response
            return guardResult.deny;
          }
          // Guard allowed, merge any locals it provided
          if (guardResult.locals) {
            context.locals = { ...context.locals, ...guardResult.locals };
          }
        }
      }

      // All guards passed, execute the handler
      return await matched.handler.handler(context);
    },
  };
}
