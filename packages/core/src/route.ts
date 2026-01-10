// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Schema interface - must have safeParse method
export interface Schema<T = unknown> {
  safeParse(data: unknown): SafeParseResult<T>;
}

// SafeParse result types
export type SafeParseResult<T> =
  | { success: true; data: T }
  | {
    success: false;
    error: { issues: Array<{ path: (string | number)[]; message: string }> };
  };

// Validation issue
export interface ValidationIssue {
  part: "params" | "query" | "body";
  path: (string | number)[];
  message: string;
}

// Input validation result - success case
export interface InputSuccess<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  ok: true;
  params: TParams;
  query: TQuery;
  body: TBody;
}

// Input validation result - failure case
export interface InputFailure {
  ok: false;
  failed: ("params" | "query" | "body")[];
  issues: ValidationIssue[];
  raw: {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
  };
}

// Input validation result union
export type InputResult<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> = InputSuccess<TParams, TQuery, TBody> | InputFailure;

// Raw, unvalidated values extracted from the request
export interface RawValues {
  /** Request's path parameters */
  readonly params: RouteParams;
  /** Request's query parameters */
  readonly query: Record<string, string | string[]>;
  /** Request's cookies */
  readonly cookies: Record<string, string>;
  /** Parsed JSON body (only if body exists and is valid JSON) */
  readonly body?: unknown;
}

// Context object passed to handlers
export interface Context<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  /** Native Request (source of truth) */
  readonly req: Request;
  /** Extracted, unvalidated values */
  readonly raw: RawValues;
  /** Validation gate */
  readonly input: InputResult<TParams, TQuery, TBody>;
  /** Shared state across guards and handlers for the request */
  locals: Record<string, unknown>;
}

// Function signature for route handlers
export type HandlerFn<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> = (
  c: Context<TParams, TQuery, TBody>,
) => Response | Promise<Response>;

// Guard result types
export type GuardResult =
  | { allow: true; locals?: Record<string, unknown> }
  | { deny: Response };

// Guard function that returns a structured result
export type GuardFn = (
  c: Context,
) => GuardResult | Promise<GuardResult>;

// Request validation schemas
export interface RequestSchemas {
  params?: Schema;
  query?: Schema;
  body?: Schema;
}

// Route configuration object
export interface RouteConfig<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  resolve: HandlerFn<TParams, TQuery, TBody>;
  guards?: GuardFn[];
  request?: RequestSchemas;
}

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
  request?: RequestSchemas;
};

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: (path: string, config: RouteConfig): Handler => ({
    method: "GET",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  head: (path: string, config: RouteConfig): Handler => ({
    method: "HEAD",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  post: (path: string, config: RouteConfig): Handler => ({
    method: "POST",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  put: (path: string, config: RouteConfig): Handler => ({
    method: "PUT",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  patch: (path: string, config: RouteConfig): Handler => ({
    method: "PATCH",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  delete: (path: string, config: RouteConfig): Handler => ({
    method: "DELETE",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  options: (path: string, config: RouteConfig): Handler => ({
    method: "OPTIONS",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  all: (path: string, config: RouteConfig): Handler => ({
    method: "*",
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
  on: (method: string, path: string, config: RouteConfig): Handler => ({
    method,
    path,
    handler: config.resolve,
    guards: config.guards,
    request: config.request,
  }),
};
