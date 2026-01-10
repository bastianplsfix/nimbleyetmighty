// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Raw, unvalidated values extracted from the request
export interface RawValues {
  /** Request's path parameters */
  readonly params: RouteParams;
  /** Request's cookies */
  readonly cookies: Record<string, string>;
}

// Context object passed to handlers
export interface Context {
  /** Native Request (source of truth) */
  readonly req: Request;
  /** Extracted, unvalidated values */
  readonly raw: RawValues;
  /** Shared state across guards and handlers for the request */
  locals: Record<string, unknown>;
}

// Result type that makes semantic intent explicit
// ok: true = semantically successful (2xx, 3xx redirects)
// ok: false = expected error (4xx validation, missing resources, domain constraints)
export type ResolveResult =
  | { ok: true; response: Response }
  | { ok: false; response: Response };

// Function signature for route handlers
// Handlers must return ResolveResult to make semantic intent explicit
export type HandlerFn = (
  c: Context,
) => ResolveResult | Promise<ResolveResult>;

// Guard result types
export type GuardResult =
  | { allow: true; locals?: Record<string, unknown> }
  | { deny: Response };

// Guard function that returns a structured result
export type GuardFn = (
  c: Context,
) => GuardResult | Promise<GuardResult>;

// Route configuration object
export interface RouteConfig {
  resolve: HandlerFn;
  guards?: GuardFn[];
}

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
};

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: (path: string, config: RouteConfig): Handler => ({
    method: "GET",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  head: (path: string, config: RouteConfig): Handler => ({
    method: "HEAD",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  post: (path: string, config: RouteConfig): Handler => ({
    method: "POST",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  put: (path: string, config: RouteConfig): Handler => ({
    method: "PUT",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  patch: (path: string, config: RouteConfig): Handler => ({
    method: "PATCH",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  delete: (path: string, config: RouteConfig): Handler => ({
    method: "DELETE",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  options: (path: string, config: RouteConfig): Handler => ({
    method: "OPTIONS",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  all: (path: string, config: RouteConfig): Handler => ({
    method: "*",
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
  on: (method: string, path: string, config: RouteConfig): Handler => ({
    method,
    path,
    handler: config.resolve,
    guards: config.guards,
  }),
};
