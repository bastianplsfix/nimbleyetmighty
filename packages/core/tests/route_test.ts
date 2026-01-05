import { assertEquals } from "@std/assert";
import { route } from "../mod.ts";

Deno.test("route.get creates a GET handler", () => {
  const handler = route.get("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "GET");
  assertEquals(handler.path, "/test");
});

Deno.test("route.post creates a POST handler", () => {
  const handler = route.post("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "POST");
  assertEquals(handler.path, "/test");
});

Deno.test("route.put creates a PUT handler", () => {
  const handler = route.put("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "PUT");
  assertEquals(handler.path, "/test");
});

Deno.test("route.delete creates a DELETE handler", () => {
  const handler = route.delete("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "DELETE");
  assertEquals(handler.path, "/test");
});

Deno.test("route.head creates a HEAD handler", () => {
  const handler = route.head("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "HEAD");
  assertEquals(handler.path, "/test");
});

Deno.test("route.patch creates a PATCH handler", () => {
  const handler = route.patch("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "PATCH");
  assertEquals(handler.path, "/test");
});

Deno.test("route.options creates an OPTIONS handler", () => {
  const handler = route.options("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "OPTIONS");
  assertEquals(handler.path, "/test");
});

Deno.test("route.all creates a wildcard handler", () => {
  const handler = route.all("/test", { resolve: () => new Response("OK") });
  assertEquals(handler.method, "*");
  assertEquals(handler.path, "/test");
});

Deno.test("route.on creates a custom method handler", () => {
  const handler = route.on("PROPFIND", "/test", {
    resolve: () => new Response("OK"),
  });
  assertEquals(handler.method, "PROPFIND");
  assertEquals(handler.path, "/test");
});

Deno.test("route supports config object with resolve", () => {
  const handler = route.get("/test", {
    resolve: () => new Response("OK"),
  });
  assertEquals(handler.method, "GET");
  assertEquals(handler.path, "/test");
  assertEquals(typeof handler.handler, "function");
});

Deno.test("route config supports guards", () => {
  const guard = () => ({ allow: true as const });
  const handler = route.get("/protected", {
    resolve: () => new Response("Secret"),
    guards: [guard],
  });
  assertEquals(handler.guards?.length, 1);
  assertEquals(handler.guards?.[0], guard);
});
