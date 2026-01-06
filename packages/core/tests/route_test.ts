// route_test.ts

import { assertEquals } from "@std/assert";
import { route } from "../mod.ts";

Deno.test("route.get creates a GET handler", () => {
  const handler = route.get("/test", () => new Response("OK"));
  assertEquals(handler.method, "GET");
  assertEquals(handler.path, "/test");
});

Deno.test("route.post creates a POST handler", () => {
  const handler = route.post("/test", () => new Response("OK"));
  assertEquals(handler.method, "POST");
  assertEquals(handler.path, "/test");
});

Deno.test("route.put creates a PUT handler", () => {
  const handler = route.put("/test", () => new Response("OK"));
  assertEquals(handler.method, "PUT");
  assertEquals(handler.path, "/test");
});

Deno.test("route.delete creates a DELETE handler", () => {
  const handler = route.delete("/test", () => new Response("OK"));
  assertEquals(handler.method, "DELETE");
  assertEquals(handler.path, "/test");
});

Deno.test("route.head creates a HEAD handler", () => {
  const handler = route.head("/test", () => new Response("OK"));
  assertEquals(handler.method, "HEAD");
  assertEquals(handler.path, "/test");
});

Deno.test("route.patch creates a PATCH handler", () => {
  const handler = route.patch("/test", () => new Response("OK"));
  assertEquals(handler.method, "PATCH");
  assertEquals(handler.path, "/test");
});

Deno.test("route.options creates an OPTIONS handler", () => {
  const handler = route.options("/test", () => new Response("OK"));
  assertEquals(handler.method, "OPTIONS");
  assertEquals(handler.path, "/test");
});

Deno.test("route.all creates a wildcard handler", () => {
  const handler = route.all("/test", () => new Response("OK"));
  assertEquals(handler.method, "*");
  assertEquals(handler.path, "/test");
});

Deno.test("route.on creates a custom method handler", () => {
  const handler = route.on("PROPFIND", "/test", () => new Response("OK"));
  assertEquals(handler.method, "PROPFIND");
  assertEquals(handler.path, "/test");
});
