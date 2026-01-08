import type {
  InputConfig,
  OutputConfig,
  ValidatedInput,
} from "./validation.ts";

// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Resolver info object passed to handlers (MSW-style)
export interface ResolverInfo<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> {
  /** Entire request reference */
  readonly request: Request;
  /** Unique request identifier (from headers or generated) */
  readonly requestId: string;
  /** Request's path parameters */
  readonly params: RouteParams;
  /** Request's cookies */
  readonly cookies: Record<string, string>;
  /** Validated input from request (body, query, params) */
  readonly input: ValidatedInput<TBody, TQuery, TParams>;
}

// Result type that makes semantic intent explicit
// ok: true = semantically successful (2xx, 3xx redirects)
// ok: false = expected error (4xx validation, missing resources, domain constraints)
export type ResolveResult =
  | { ok: true; response: Response }
  | { ok: false; response: Response };

// Function signature for route handlers
// Handlers must return ResolveResult to make semantic intent explicit
export type HandlerFn<TBody = unknown, TQuery = unknown, TParams = unknown> = (
  info: ResolverInfo<TBody, TQuery, TParams>,
) => ResolveResult | Promise<ResolveResult>;

// Guard result types
export type GuardResult =
  | { allow: true }
  | { deny: Response };

// Guard function that returns a structured result
export type GuardFn<TBody = unknown, TQuery = unknown, TParams = unknown> = (
  info: ResolverInfo<TBody, TQuery, TParams>,
) => GuardResult | Promise<GuardResult>;

// Route configuration object
export interface RouteConfig<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  TOutput = unknown,
> {
  input?: InputConfig<TBody, TQuery, TParams>;
  output?: OutputConfig<TOutput>;
  resolve: HandlerFn<TBody, TQuery, TParams>;
  guards?: GuardFn<TBody, TQuery, TParams>[];
}

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
  input?: InputConfig;
  output?: OutputConfig;
};

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: (path: string, config: RouteConfig): Handler => ({
    method: "GET",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  head: (path: string, config: RouteConfig): Handler => ({
    method: "HEAD",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  post: (path: string, config: RouteConfig): Handler => ({
    method: "POST",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  put: (path: string, config: RouteConfig): Handler => ({
    method: "PUT",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  patch: (path: string, config: RouteConfig): Handler => ({
    method: "PATCH",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  delete: (path: string, config: RouteConfig): Handler => ({
    method: "DELETE",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  options: (path: string, config: RouteConfig): Handler => ({
    method: "OPTIONS",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  all: (path: string, config: RouteConfig): Handler => ({
    method: "*",
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
  on: (method: string, path: string, config: RouteConfig): Handler => ({
    method,
    path,
    handler: config.resolve,
    guards: config.guards,
    input: config.input,
    output: config.output,
  }),
};
