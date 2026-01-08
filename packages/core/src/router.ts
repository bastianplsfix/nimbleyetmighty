import type { Handler, RouteParams } from "./route.ts";
import { parseCookies } from "./cookies.ts";
import { resolveRequestId } from "./internal/request_id.ts";
import {
  defaultValidationErrorResponse,
  runValidator,
} from "./internal/validation.ts";
import { normalizeSchema } from "./internal/schema_adapter.ts";

interface CompiledRoute {
  handler: Handler;
  pattern: URLPattern;
}

export interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}

export function createRouter(
  handlers: Handler[],
) {
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
    handle: async (req: Request): Promise<Response> => {
      const matched = match(req.method, req.url);
      if (!matched) {
        return new Response("Not Found", { status: 404 });
      }

      const requestId = resolveRequestId(req.headers);
      const cookies = parseCookies(req.headers.get("cookie"));

      // Build input object from validated data
      const input: any = {};

      // Run validation if configured
      if (matched.handler.request) {
        const { request: requestValidation } = matched.handler;

        // Validate params
        if (requestValidation.params) {
          const validator = normalizeSchema(requestValidation.params);
          const result = await runValidator(validator, matched.params);
          if (!result.valid) {
            return result.response;
          }
          // Store validated data in input
          input.params = result.data;
        }

        // Validate query parameters
        if (requestValidation.query) {
          const url = new URL(req.url);
          const query: Record<string, string | string[]> = {};
          for (const [key, value] of url.searchParams.entries()) {
            const existing = query[key];
            if (existing) {
              query[key] = Array.isArray(existing)
                ? [...existing, value]
                : [existing, value];
            } else {
              query[key] = value;
            }
          }
          const validator = normalizeSchema(requestValidation.query);
          const result = await runValidator(validator, query);
          if (!result.valid) {
            return result.response;
          }
          // Store validated data in input
          input.query = result.data;
        }

        // Validate body (for POST/PUT/PATCH)
        // Framework owns body parsing when request.body is declared
        if (
          requestValidation.body &&
          (req.method === "POST" || req.method === "PUT" ||
            req.method === "PATCH")
        ) {
          try {
            // Parse body as JSON (default)
            const body = await req.json();
            const validator = normalizeSchema(requestValidation.body);
            const result = await runValidator(validator, body);
            if (!result.valid) {
              return result.response;
            }
            // Store validated data in input
            input.body = result.data;
          } catch (error) {
            return Response.json(
              { error: "Invalid JSON body" },
              { status: 400 },
            );
          }
        }

        // Validate headers
        if (requestValidation.headers) {
          const headers: Record<string, string> = {};
          req.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
          });
          const validator = normalizeSchema(requestValidation.headers);
          const result = await runValidator(validator, headers);
          if (!result.valid) {
            return result.response;
          }
          // Store validated data in input
          input.headers = result.data;
        }
      }

      // Build ResolverInfo with input
      const resolverInfo = {
        request: req,
        requestId,
        params: matched.params,
        cookies,
        input,
      };

      // Execute guards in order
      if (matched.handler.guards && matched.handler.guards.length > 0) {
        for (const guard of matched.handler.guards) {
          const guardResult = await guard(resolverInfo);
          if ("deny" in guardResult) {
            // Guard denied the request, return the denial response
            return guardResult.deny;
          }
          // Guard allowed, continue to next guard
        }
      }

      // All guards passed, execute the handler
      const result = await matched.handler.handler(resolverInfo);

      // Extract the response from ResolveResult
      return result.response;
    },
  };
}
