// runtime.ts

import type { Handler, ResolverInfo } from "./route.ts";
import { createRouter } from "./router.ts";

// Error context passed to onError handler
export interface ErrorContext {
  /** The original request that caused the error */
  readonly request: Request;
  /** Unique request identifier */
  readonly requestId: string;
  /** The error that was thrown */
  readonly error: unknown;
}

// onError handler that processes unexpected exceptions
export type OnErrorHandler = (
  ctx: ErrorContext,
) => Response | Promise<Response>;

// Default onError implementation: logs the error and returns a sanitized 500 response
const defaultOnError: OnErrorHandler = (ctx) => {
  // Log the unexpected error
  console.error(
    `[${ctx.requestId}] Unexpected error during request handling:`,
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

  const router = createRouter(handlers);

  return {
    // Standard fetch signature compatible with Deno.serve / Bun.serve
    fetch: async (req: Request): Promise<Response> => {
      try {
        // Normal request processing - guards and handlers use explicit returns
        return await router.handle(req);
      } catch (error) {
        // Exception caught = unexpected failure (bug, crash, infrastructure problem)
        // Delegate to centralized onError handler
        const requestId = req.headers.get("x-request-id") ??
          req.headers.get("x-correlation-id") ??
          crypto.randomUUID();

        return await onError({
          request: req,
          requestId,
          error,
        });
      }
    },
  };
}
