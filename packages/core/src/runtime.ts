// runtime.ts

import type { Handler } from "./route.ts";
import { createRouter } from "./router.ts";

// Error context passed to onError handler
export interface ErrorContext {
  /** The original request that caused the error */
  readonly request: Request;
  /** The error that was thrown */
  readonly error: unknown;
}

// onError handler that processes unexpected exceptions
export type OnErrorHandler = (
  ctx: ErrorContext,
) => Response | Promise<Response>;

// onRequest hook that runs before routing begins
// Returns a locals patch to be merged into c.locals
export type OnRequestHandler = (
  request: Request,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

// onResponse hook that runs after handler execution, before returning response
export type OnResponseHandler = (
  request: Request,
  response: Response,
) => Response | Promise<Response>;

// Default onError implementation: logs the error and returns a sanitized 500 response
const defaultOnError: OnErrorHandler = (ctx) => {
  // Log the unexpected error
  console.error(
    "Unexpected error during request handling:",
    ctx.error,
  );

  // Return a sanitized 500 response - don't leak error details to clients
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 },
  );
};

// Configuration options for setupNimble
export interface NimbleConfig {
  /** Route handlers */
  handlers: Handler[];
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
  const handlers = Array.isArray(config) ? config : config.handlers;
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
        // Run onRequest hook before routing to get initial locals
        const initialLocals = onRequest ? await onRequest(req) : {};

        // Normal request processing - guards and handlers use explicit returns
        let response = await router.handle(req, initialLocals);

        // Run onResponse hook after handler execution
        if (onResponse) {
          response = await onResponse(req, response);
        }

        return response;
      } catch (error) {
        // Exception caught = unexpected failure (bug, crash, infrastructure problem)
        // Delegate to centralized onError handler
        return await onError({
          request: req,
          error,
        });
      }
    },
  };
}
