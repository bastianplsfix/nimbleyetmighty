import { assertEquals } from "@std/assert";
import { group } from "../mod.ts";
import { route } from "../mod.ts";

Deno.test("group flattens a single handler", () => {
  const handler = route.get("/test", () => new Response("OK"));
  const handlers = group([handler]);

  assertEquals(handlers.length, 1);
  assertEquals(handlers[0].method, "GET");
  assertEquals(handlers[0].path, "/test");
});

Deno.test("group flattens multiple handlers", () => {
  const handler1 = route.get("/users", () => new Response("Users"));
  const handler2 = route.post("/users", () => new Response("Create User"));
  const handlers = group([handler1, handler2]);

  assertEquals(handlers.length, 2);
  assertEquals(handlers[0].method, "GET");
  assertEquals(handlers[0].path, "/users");
  assertEquals(handlers[1].method, "POST");
  assertEquals(handlers[1].path, "/users");
});

Deno.test("group flattens nested handler arrays", () => {
  const userHandlers = [
    route.get("/users", () => new Response("Users")),
    route.post("/users", () => new Response("Create User")),
  ];
  const productHandlers = [
    route.get("/products", () => new Response("Products")),
    route.post("/products", () => new Response("Create Product")),
  ];
  const handlers = group([userHandlers, productHandlers]);

  assertEquals(handlers.length, 4);
  assertEquals(handlers[0].path, "/users");
  assertEquals(handlers[1].path, "/users");
  assertEquals(handlers[2].path, "/products");
  assertEquals(handlers[3].path, "/products");
});

Deno.test("group flattens deeply nested handler groups", () => {
  const userHandlers = [
    route.get("/users", () => new Response("Users")),
    route.post("/users", () => new Response("Create User")),
  ];
  const productHandlers = [
    route.get("/products", () => new Response("Products")),
  ];
  const adminHandlers = group([userHandlers, productHandlers]);
  const publicHandlers = [
    route.get("/", () => new Response("Home")),
  ];
  const allHandlers = group([adminHandlers, publicHandlers]);

  assertEquals(allHandlers.length, 4);
  assertEquals(allHandlers[0].path, "/users");
  assertEquals(allHandlers[1].path, "/users");
  assertEquals(allHandlers[2].path, "/products");
  assertEquals(allHandlers[3].path, "/");
});

Deno.test("group handles mixed single handlers and arrays", () => {
  const userHandlers = [
    route.get("/users", () => new Response("Users")),
    route.post("/users", () => new Response("Create User")),
  ];
  const handlers = group([
    userHandlers,
    route.get("/products", () => new Response("Products")),
    route.get("/", () => new Response("Home")),
  ]);

  assertEquals(handlers.length, 4);
  assertEquals(handlers[0].path, "/users");
  assertEquals(handlers[1].path, "/users");
  assertEquals(handlers[2].path, "/products");
  assertEquals(handlers[3].path, "/");
});
