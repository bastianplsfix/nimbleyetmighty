// route.ts

import type {
  InferSchema,
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

// Route configuration object with type inference
// If input schemas are provided with types (e.g., Zod), TBody/TQuery/TParams are inferred
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

// Helper to infer schema types from input config
type InferInputTypes<T> = T extends {
  input: {
    body?: infer B;
    query?: infer Q;
    params?: infer P;
  };
} ? {
    body: InferSchema<B>;
    query: InferSchema<Q>;
    params: InferSchema<P>;
  }
  : { body: unknown; query: unknown; params: unknown };

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "GET",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  head: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "HEAD",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  post: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "POST",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  put: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "PUT",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  patch: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "PATCH",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  delete: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "DELETE",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  options: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "OPTIONS",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  all: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method: "*",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
  on: <
    const TInput extends
      | { body?: any; query?: any; params?: any }
      | undefined = undefined,
  >(
    method: string,
    path: string,
    config:
      & RouteConfig<
        TInput extends { body: infer B } ? InferSchema<B> : unknown,
        TInput extends { query: infer Q } ? InferSchema<Q> : unknown,
        TInput extends { params: infer P } ? InferSchema<P> : unknown
      >
      & { input?: TInput },
  ): Handler => ({
    method,
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards as GuardFn[] | undefined,
    input: config.input,
    output: config.output,
  }),
};
