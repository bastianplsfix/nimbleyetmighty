// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Generic validator interface - works with any validation library
// Validators return ValidationResult to match framework's error handling pattern
export interface Validator<TInput = unknown, TOutput = TInput> {
  validate: (
    value: TInput,
  ) => ValidationResult<TOutput> | Promise<ValidationResult<TOutput>>;
}

// Validation result types - mirrors ResolveResult pattern
export type ValidationResult<T = unknown> =
  | { valid: true; data: T }
  | { valid: false; response: Response };

// Schema that can be adapted (Zod, Valibot, or native Validator)
export type Schema<TInput = unknown, TOutput = TInput> =
  | Validator<TInput, TOutput>
  | {
    safeParse: (
      value: TInput,
    ) => { success: true; data: TOutput } | { success: false; error: unknown };
  }
  | { parse: (value: TInput) => TOutput };

// Request validation schemas for different parts of the request
// Accepts native Validator or schemas with safeParse/parse (Zod, Valibot)
export interface RequestValidation {
  params?: Schema<RouteParams, any>;
  query?: Schema<Record<string, string | string[]>, any>;
  body?: Schema<unknown, any>;
  headers?: Schema<Record<string, string>, any>;
}

// Validated input data (only present for validated request parts)
export interface ValidatedInput {
  params?: any;
  query?: any;
  body?: any;
  headers?: any;
}

// Resolver info object passed to handlers
export interface ResolverInfo<TInput = undefined> {
  /** Entire request reference (raw HTTP) */
  readonly request: Request;
  /** Unique request identifier (from headers or generated) */
  readonly requestId: string;
  /** Request's path parameters (raw strings from routing) */
  readonly params: RouteParams;
  /** Request's cookies */
  readonly cookies: Record<string, string>;
  /** Validated input data (only present if request validation is defined) */
  readonly input?: TInput;
}

// Result type that makes semantic intent explicit
// ok: true = semantically successful (2xx, 3xx redirects)
// ok: false = expected error (4xx validation, missing resources, domain constraints)
export type ResolveResult =
  | { ok: true; response: Response }
  | { ok: false; response: Response };

// Function signature for route handlers
// Handlers must return ResolveResult to make semantic intent explicit
export type HandlerFn<TInput = undefined> = (
  info: ResolverInfo<TInput>,
) => ResolveResult | Promise<ResolveResult>;

// Guard result types
export type GuardResult =
  | { allow: true }
  | { deny: Response };

// Guard function that returns a structured result
export type GuardFn<TInput = undefined> = (
  info: ResolverInfo<TInput>,
) => GuardResult | Promise<GuardResult>;

// Route configuration object
export interface RouteConfig {
  request?: RequestValidation;
  guards?: GuardFn[];
  resolve: HandlerFn;
}

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  request?: RequestValidation;
  guards?: GuardFn[];
  handler: HandlerFn;
};

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: (path: string, config: RouteConfig): Handler => ({
    method: "GET",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  head: (path: string, config: RouteConfig): Handler => ({
    method: "HEAD",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  post: (path: string, config: RouteConfig): Handler => ({
    method: "POST",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  put: (path: string, config: RouteConfig): Handler => ({
    method: "PUT",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  patch: (path: string, config: RouteConfig): Handler => ({
    method: "PATCH",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  delete: (path: string, config: RouteConfig): Handler => ({
    method: "DELETE",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  options: (path: string, config: RouteConfig): Handler => ({
    method: "OPTIONS",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  all: (path: string, config: RouteConfig): Handler => ({
    method: "*",
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
  on: (method: string, path: string, config: RouteConfig): Handler => ({
    method,
    path,
    request: config.request,
    guards: config.guards,
    handler: config.resolve,
  }),
};
