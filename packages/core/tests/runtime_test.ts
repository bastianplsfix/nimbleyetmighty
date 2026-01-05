import { assertEquals } from "@std/assert";
import { route, setupNimble } from "../mod.ts";

Deno.test("setupNimble returns object with fetch method", () => {
  const app = setupNimble([]);
  assertEquals(typeof app.fetch, "function");
});

Deno.test("setupNimble.fetch matches GET route", async () => {
  const app = setupNimble([
    route.get("/hello", () => new Response("Hello World")),
  ]);

  const req = new Request("http://localhost/hello", { method: "GET" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "Hello World");
});

Deno.test("setupNimble.fetch matches POST route", async () => {
  const app = setupNimble([
    route.post("/data", () => new Response("Posted")),
  ]);

  const req = new Request("http://localhost/data", { method: "POST" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "Posted");
});

Deno.test("setupNimble.fetch returns 404 for unmatched path", async () => {
  const app = setupNimble([
    route.get("/exists", () => new Response("OK")),
  ]);

  const req = new Request("http://localhost/not-found", { method: "GET" });
  const res = await app.fetch(req);

  assertEquals(res.status, 404);
  assertEquals(await res.text(), "Not Found");
});

Deno.test("setupNimble.fetch returns 404 for unmatched method", async () => {
  const app = setupNimble([
    route.get("/test", () => new Response("OK")),
  ]);

  const req = new Request("http://localhost/test", { method: "POST" });
  const res = await app.fetch(req);

  assertEquals(res.status, 404);
});

Deno.test("setupNimble.fetch handler receives request", async () => {
  const app = setupNimble([
    route.post("/echo", async (req) => {
      const body = await req.text();
      return new Response(body);
    }),
  ]);

  const req = new Request("http://localhost/echo", {
    method: "POST",
    body: "test body",
  });
  const res = await app.fetch(req);

  assertEquals(await res.text(), "test body");
});
