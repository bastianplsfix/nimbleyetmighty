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
