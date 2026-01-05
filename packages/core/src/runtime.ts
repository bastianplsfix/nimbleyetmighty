// runtime.ts

import type { Handler } from "./route.ts";
import { createRouter } from "./router.ts";

// Bootstrap the framework: returns a fetch handler for Deno/Bun servers
export function setupNimble(handlers: Handler[]) {
  const router = createRouter(handlers);

  return {
    // Standard fetch signature compatible with Deno.serve / Bun.serve
    fetch: (req: Request): Response | Promise<Response> => {
      return router.handle(req);
    },
  };
}
