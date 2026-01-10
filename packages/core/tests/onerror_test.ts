import { assertEquals } from "@std/assert";
import { route, setupNimble } from "../mod.ts";

Deno.test("onError: receives error and context", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Something went wrong");
        },
      }),
    ],
    onError: (error, c) => {
      const err = error as Error;
      return Response.json({
        error: err.message,
        method: c.req.method,
      }, { status: 500 });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Something went wrong");
  assertEquals(body.method, "GET");
});

Deno.test("onError: can access locals from context", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Fail");
        },
      }),
    ],
    onRequest: () => ({
      requestId: "req-789",
    }),
    onError: (error, c) => {
      return Response.json({
        requestId: c.locals.requestId,
        error: "Internal error",
      }, { status: 500 });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.requestId, "req-789");
});

Deno.test("onError: can access route params from context", async () => {
  const app = setupNimble({
    routes: [
      route.get("/users/:id/fail", {
        resolve: () => {
          throw new Error("User processing failed");
        },
      }),
    ],
    onError: (error, c) => {
      return Response.json({
        userId: c.raw.params.id,
        error: "Failed to process user",
      }, { status: 500 });
    },
  });

  const res = await app.fetch(new Request("http://localhost/users/999/fail"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.userId, "999");
});

Deno.test("onError: default handler logs and returns 500", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Unexpected error");
        },
      }),
    ],
    // No custom onError - should use default
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Internal Server Error");
});

Deno.test("onError: async handler works", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Async test error");
        },
      }),
    ],
    onError: async (error, c) => {
      // Simulate async error logging
      await new Promise((resolve) => setTimeout(resolve, 1));
      return Response.json({
        error: "Handled async",
      }, { status: 500 });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Handled async");
});

Deno.test("onError: handles errors from guards", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        guards: [
          () => {
            throw new Error("Guard error");
          },
        ],
        resolve: () => new Response("Should not reach here"),
      }),
    ],
    onError: (error, c) => {
      const err = error as Error;
      return Response.json({
        error: err.message,
        stage: "guard",
      }, { status: 500 });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Guard error");
});
