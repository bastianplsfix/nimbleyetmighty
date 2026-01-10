import type { Context, Handler, RouteParams } from "./route.ts";
import { parseCookies } from "./cookies.ts";
import {
  parseBody,
  parseQuery,
  validateInputs,
} from "./internal/validation.ts";

// Avoid circular dependency: OnRequestHandler type is defined inline
type OnRequestHandler = (
  c: Context,
) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;

interface CompiledRoute {
  handler: Handler;
  pattern: URLPattern;
}

export interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}

export interface RouterResponse {
  response: Response;
  context: Context;
}

export interface Router {
  match: (method: string, url: string) => RouteMatch | null;
  handle: (
    req: Request,
    onRequest?: OnRequestHandler,
  ) => Promise<RouterResponse>;
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
      onRequest?: OnRequestHandler,
    ): Promise<RouterResponse> => {
      const matched = match(req.method, req.url);
      if (!matched) {
        // Create minimal context for 404 response
        const notFoundContext: Context = {
          req,
          raw: { params: {}, query: {}, cookies: {}, body: undefined },
          input: { ok: true, params: {}, query: {}, body: {} },
          locals: {},
        };
        return {
          response: new Response("Not Found", { status: 404 }),
          context: notFoundContext,
        };
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

      // Create initial context with empty locals
      let context: Context = {
        req,
        raw: {
          params: matched.params,
          query,
          cookies,
          body,
        },
        input,
        locals: {},
      };

      // Run onRequest hook to get initial locals (receives full context)
      // Creates new context with merged locals
      if (onRequest) {
        const localsPatch = await onRequest(context);
        if (localsPatch) {
          context = {
            ...context,
            locals: { ...context.locals, ...localsPatch },
          };
        }
      }

      // Execute guards in order
      // Each guard that adds locals creates a new context
      if (matched.handler.guards && matched.handler.guards.length > 0) {
        for (const guard of matched.handler.guards) {
          try {
            const guardResult = await guard(context);
            if ("deny" in guardResult) {
              // Guard denied the request, return the denial response
              return {
                response: guardResult.deny,
                context,
              };
            }
            // Guard allowed, merge any locals it provided
            // Create new context with accumulated locals
            if (guardResult.locals) {
              context = {
                ...context,
                locals: { ...context.locals, ...guardResult.locals },
              };
            }
          } catch (error) {
            // Attach context to error so onError can access it
            (error as any).context = context;
            throw error;
          }
        }
      }

      // All guards passed, execute the handler
      try {
        const response = await matched.handler.handler(context);
        return {
          response,
          context,
        };
      } catch (error) {
        // Attach context to error so onError can access it
        (error as any).context = context;
        throw error;
      }
    },
  };
}
