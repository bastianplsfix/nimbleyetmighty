// router_test.ts

import { assertEquals } from "@std/assert";
import { createRouter } from "../../core/src/router.ts";
import { route } from "../../core/src/route.ts";

Deno.test("createRouter.match returns null for no routes", () => {
  const router = createRouter([]);
  assertEquals(router.match("GET", "http://localhost/test"), null);
});

Deno.test("createRouter.match extracts path params", () => {
  const router = createRouter([
    route.get("/users/:id", () => new Response("OK")),
  ]);
  const result = router.match("GET", "http://localhost/users/123");
  assertEquals(result?.params.id, "123");
});

Deno.test("handler receives parsed URL object", async () => {
  const router = createRouter([
    route.get(
      "/search",
      ({ url }) => new Response(url.searchParams.get("q") ?? ""),
    ),
  ]);
  const req = new Request("http://localhost/search?q=hello");
  const res = await router.handle(req);
  assertEquals(await res.text(), "hello");
});

Deno.test("handler receives parsed cookies", async () => {
  const router = createRouter([
    route.get("/auth", ({ cookies }) => new Response(cookies.token ?? "none")),
  ]);
  const req = new Request("http://localhost/auth", {
    headers: { cookie: "token=abc123; other=value" },
  });
  const res = await router.handle(req);
  assertEquals(await res.text(), "abc123");
});
