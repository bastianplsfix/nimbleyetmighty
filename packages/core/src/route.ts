// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Resolver info object passed to handlers (MSW-style)
export interface ResolverInfo {
  /** Entire request reference */
  request: Request;
  /** Unique request identifier (from headers or generated) */
  requestId: string;
  /** Request's path parameters */
  params: RouteParams;
  /** Request's cookies */
  cookies: Record<string, string>;
}

// Function signature for route handlers
export type HandlerFn = (info: ResolverInfo) => Response | Promise<Response>;

// Guard function that can allow or reject a request
// Returns null/undefined to allow, or a Response to reject
export type GuardFn = (
  info: ResolverInfo,
) => Response | null | undefined | Promise<Response | null | undefined>;

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
};

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: (path: string, handler: HandlerFn): Handler => ({
    method: "GET",
    path,
    handler,
  }),
  head: (path: string, handler: HandlerFn): Handler => ({
    method: "HEAD",
    path,
    handler,
  }),
  post: (path: string, handler: HandlerFn): Handler => ({
    method: "POST",
    path,
    handler,
  }),
  put: (path: string, handler: HandlerFn): Handler => ({
    method: "PUT",
    path,
    handler,
  }),
  patch: (path: string, handler: HandlerFn): Handler => ({
    method: "PATCH",
    path,
    handler,
  }),
  delete: (path: string, handler: HandlerFn): Handler => ({
    method: "DELETE",
    path,
    handler,
  }),
  options: (path: string, handler: HandlerFn): Handler => ({
    method: "OPTIONS",
    path,
    handler,
  }),
  all: (path: string, handler: HandlerFn): Handler => ({
    method: "*",
    path,
    handler,
  }),
  on: (method: string, path: string, handler: HandlerFn): Handler => ({
    method,
    path,
    handler,
  }),
};
