export type HandlerFn = (req: Request) => Response | Promise<Response>;

export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
};

export const route = {
  get: (path: string, handler: HandlerFn): Handler => ({
    method: "GET",
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
  delete: (path: string, handler: HandlerFn): Handler => ({
    method: "DELETE",
    path,
    handler,
  }),
};
