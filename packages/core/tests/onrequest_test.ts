import { assertEquals } from "@std/assert";
import { route, setupNimble } from "../mod.ts";

Deno.test("onRequest: returns locals patch that gets merged", async () => {
  const app = setupNimble({
    handlers: [
      route.get("/test", {
        resolve: (c) => {
          return Response.json(c.locals);
        },
      }),
    ],
    onRequest: () => {
      return {
        requestId: "test-123",
        timestamp: 1234567890,
      };
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  const locals = await res.json();
  assertEquals(locals.requestId, "test-123");
  assertEquals(locals.timestamp, 1234567890);
});

Deno.test("onRequest: async function works", async () => {
  const app = setupNimble({
    handlers: [
      route.get("/test", {
        resolve: (c) => {
          return Response.json(c.locals);
        },
      }),
    ],
    onRequest: async () => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 1));
      return {
        asyncValue: "loaded",
      };
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  const locals = await res.json();
  assertEquals(locals.asyncValue, "loaded");
});

Deno.test("onRequest: locals merge with guard locals", async () => {
  const app = setupNimble({
    handlers: [
      route.get("/test", {
        guards: [
          () => ({
            allow: true,
            locals: {
              guardValue: "from-guard",
            },
          }),
        ],
        resolve: (c) => {
          return Response.json(c.locals);
        },
      }),
    ],
    onRequest: () => {
      return {
        requestValue: "from-request",
      };
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  const locals = await res.json();
  assertEquals(locals.requestValue, "from-request");
  assertEquals(locals.guardValue, "from-guard");
});

Deno.test("onRequest: guard locals override onRequest locals", async () => {
  const app = setupNimble({
    handlers: [
      route.get("/test", {
        guards: [
          () => ({
            allow: true,
            locals: {
              value: "from-guard",
            },
          }),
        ],
        resolve: (c) => {
          return Response.json(c.locals);
        },
      }),
    ],
    onRequest: () => {
      return {
        value: "from-request",
      };
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  const locals = await res.json();
  // Guard value should override onRequest value
  assertEquals(locals.value, "from-guard");
});

Deno.test("onRequest: no onRequest means empty initial locals", async () => {
  const app = setupNimble([
    route.get("/test", {
      resolve: (c) => {
        return Response.json({
          hasLocals: Object.keys(c.locals).length > 0,
        });
      },
    }),
  ]);

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { hasLocals: false });
});

Deno.test("onRequest: can access full context", async () => {
  const app = setupNimble({
    handlers: [
      route.get("/test/:id", {
        resolve: (c) => {
          return Response.json(c.locals);
        },
      }),
    ],
    onRequest: (c) => {
      const url = new URL(c.req.url);
      return {
        method: c.req.method,
        pathname: url.pathname,
        hasParams: Object.keys(c.raw.params).length > 0,
        paramId: c.raw.params.id,
      };
    },
  });

  const res = await app.fetch(new Request("http://localhost/test/123"));
  assertEquals(res.status, 200);
  const locals = await res.json();
  assertEquals(locals.method, "GET");
  assertEquals(locals.pathname, "/test/123");
  assertEquals(locals.hasParams, true);
  assertEquals(locals.paramId, "123");
});
