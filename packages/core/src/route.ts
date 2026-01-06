// route.ts

// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Context object passed to handlers (MSW-style)
export interface HandlerContext {
  request: Request;
  params: RouteParams;
  url: URL;
  cookies: Record<string, string>;
}

// Function signature for route handlers
export type HandlerFn = (ctx: HandlerContext) => Response | Promise<Response>;

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
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
  // Special method that matches any HTTP method
  all: (path: string, handler: HandlerFn): Handler => ({
    method: "*",
    path,
    handler,
  }),
  // Escape hatch for custom/non-standard HTTP methods
  on: (method: string, path: string, handler: HandlerFn): Handler => ({
    method,
    path,
    handler,
  }),
};
