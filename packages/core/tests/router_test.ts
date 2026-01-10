import { assertEquals } from "@std/assert";
import { createRouter } from "../../core/src/router.ts";
import { route } from "../../core/src/route.ts";

Deno.test("createRouter.match returns null for no routes", () => {
  const router = createRouter([]);
  assertEquals(router.match("GET", "http://localhost/test"), null);
});

Deno.test("createRouter.match extracts path params", () => {
  const router = createRouter([
    route.get("/users/:id", {
      resolve: () => ({ ok: true, response: new Response("OK") }),
    }),
  ]);
  const result = router.match("GET", "http://localhost/users/123");
  assertEquals(result?.params.id, "123");
});

Deno.test("handler receives parsed cookies", async () => {
  const router = createRouter([
    route.get("/auth", {
      resolve: ({ cookies }) => ({
        ok: true,
        response: new Response(cookies.token ?? "none"),
      }),
    }),
  ]);
  const req = new Request("http://localhost/auth", {
    headers: { cookie: "token=abc123; other=value" },
  });
  const res = await router.handle(req);
  assertEquals(await res.text(), "abc123");
});

Deno.test("handler can access URL via request", async () => {
  const router = createRouter([
    route.get("/search", {
      resolve: ({ request }) => {
        const url = new URL(request.url);
        return {
          ok: true,
          response: new Response(url.searchParams.get("q") ?? ""),
        };
      },
    }),
  ]);
  const req = new Request("http://localhost/search?q=hello");
  const res = await router.handle(req);
  assertEquals(await res.text(), "hello");
});

Deno.test("createRouter.match extracts multiple path params", () => {
  const router = createRouter([
    route.get("/users/:userId/posts/:postId", {
      resolve: () => ({ ok: true, response: new Response("OK") }),
    }),
  ]);
  const result = router.match("GET", "http://localhost/users/42/posts/7");
  assertEquals(result?.params.userId, "42");
  assertEquals(result?.params.postId, "7");
});

Deno.test("createRouter.match returns null for wrong method", () => {
  const router = createRouter([
    route.get("/test", {
      resolve: () => ({ ok: true, response: new Response("OK") }),
    }),
  ]);
  assertEquals(router.match("POST", "http://localhost/test"), null);
});

Deno.test("createRouter.match matches wildcard method", () => {
  const router = createRouter([
    route.all("/any", {
      resolve: () => ({ ok: true, response: new Response("OK") }),
    }),
  ]);
  assertEquals(
    router.match("GET", "http://localhost/any")?.handler.method,
    "*",
  );
  assertEquals(
    router.match("POST", "http://localhost/any")?.handler.method,
    "*",
  );
  assertEquals(
    router.match("DELETE", "http://localhost/any")?.handler.method,
    "*",
  );
});

Deno.test("createRouter.handle returns 404 for no match", async () => {
  const router = createRouter([]);
  const req = new Request("http://localhost/nothing");
  const res = await router.handle(req);
  assertEquals(res.status, 404);
  assertEquals(await res.text(), "Not Found");
});
