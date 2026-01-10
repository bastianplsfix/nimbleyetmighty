// runtime.ts

import type { Context, Handler } from "./route.ts";
import { createRouter } from "./router.ts";

// onError handler that processes unexpected exceptions
export type OnErrorHandler = (
  error: unknown,
  c: Context,
) => Response | Promise<Response>;

// onRequest hook that runs before routing begins
// Returns a locals patch to be merged into c.locals
export type OnRequestHandler = (
  c: Context,
) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;

// onResponse hook that runs after handler execution, before returning response
export type OnResponseHandler = (
  c: Context,
  response: Response,
) => Response | Promise<Response>;

// Default onError implementation: logs the error and returns a sanitized 500 response
const defaultOnError: OnErrorHandler = (error, c) => {
  // Log the unexpected error
  console.error(
    "Unexpected error during request handling:",
    error,
  );

  // Return a sanitized 500 response - don't leak error details to clients
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 },
  );
};

// Configuration options for setupNimble
export interface NimbleConfig {
  /** Routes to register */
  routes: Handler[];
  /** Custom error handler for unexpected exceptions (optional) */
  onError?: OnErrorHandler;
  /** Hook that runs before routing begins (optional) */
  onRequest?: OnRequestHandler;
  /** Hook that runs after handler execution, before returning response (optional) */
  onResponse?: OnResponseHandler;
}

// Bootstrap the framework: returns a fetch handler for Deno/Bun servers
export function setupNimble(
  config: Handler[] | NimbleConfig,
) {
  // Support both array of handlers (legacy) and config object
  const handlers = Array.isArray(config) ? config : config.routes;
  const onError = Array.isArray(config)
    ? defaultOnError
    : (config.onError ?? defaultOnError);
  const onRequest = Array.isArray(config) ? undefined : config.onRequest;
  const onResponse = Array.isArray(config) ? undefined : config.onResponse;

  const router = createRouter(handlers);

  return {
    // Standard fetch signature compatible with Deno.serve / Bun.serve
    fetch: async (req: Request): Promise<Response> => {
      try {
        // Normal request processing - guards and handlers use explicit returns
        // onRequest hook is now called inside router.handle to receive full context
        let response = await router.handle(req, onRequest);

        // Run onResponse hook after handler execution
        // Note: onResponse receives the full context from the route handler
        if (onResponse && response.context) {
          response.response = await onResponse(
            response.context,
            response.response,
          );
        }

        return response.response;
      } catch (error) {
        // Exception caught = unexpected failure (bug, crash, infrastructure problem)
        // We need to build a minimal context for onError
        // If we have context from the error, use it; otherwise create a minimal one
        const context = (error as any).context || {
          req,
          raw: { params: {}, query: {}, cookies: {}, body: undefined },
          input: { ok: true, params: {}, query: {}, body: {} },
          locals: {},
        };

        return await onError(error, context);
      }
    },
  };
}
