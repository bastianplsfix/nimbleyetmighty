import { assertEquals } from "@std/assert";
import { route, setupNimble } from "../mod.ts";

Deno.test("onResponse: receives context and response", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          return new Response("original");
        },
      }),
    ],
    onResponse: (c, res) => {
      const headers = new Headers(res.headers);
      headers.set("x-method", c.req.method);
      return new Response(res.body, {
        status: res.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-method"), "GET");
  assertEquals(await res.text(), "original");
});

Deno.test("onResponse: can access locals from context", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          return new Response("ok");
        },
      }),
    ],
    onRequest: () => ({
      requestId: "req-123",
    }),
    onResponse: (c, res) => {
      const headers = new Headers(res.headers);
      headers.set("x-request-id", String(c.locals.requestId));
      return new Response(res.body, {
        status: res.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-request-id"), "req-123");
});

Deno.test("onResponse: can access route params from context", async () => {
  const app = setupNimble({
    routes: [
      route.get("/users/:id", {
        resolve: () => {
          return new Response("user data");
        },
      }),
    ],
    onResponse: (c, res) => {
      const headers = new Headers(res.headers);
      headers.set("x-user-id", String(c.raw.params.id));
      return new Response(res.body, {
        status: res.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/users/456"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-user-id"), "456");
});

Deno.test("onResponse: can modify response status", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          return new Response("ok", { status: 200 });
        },
      }),
    ],
    onResponse: (c, res) => {
      // Force all responses to 202 Accepted
      return new Response(res.body, {
        status: 202,
        headers: res.headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 202);
});

Deno.test("onResponse: async handler works", async () => {
  const app = setupNimble({
    routes: [
      route.get("/test", {
        resolve: () => {
          return new Response("ok");
        },
      }),
    ],
    onResponse: async (c, res) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 1));
      const headers = new Headers(res.headers);
      headers.set("x-async", "true");
      return new Response(res.body, {
        status: res.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-async"), "true");
});
