import type { Handler } from "./route.ts";
import { createRouter } from "./router.ts";

export function setupNimble(handlers: Handler[]) {
  const router = createRouter(handlers);

  return {
    fetch: (req: Request): Response | Promise<Response> => {
      return router.handle(req);
    },
  };
}
