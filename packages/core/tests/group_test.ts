import { assertEquals } from "@std/assert";
import { group, type GuardFn } from "../mod.ts";
import { route } from "../mod.ts";

Deno.test("group flattens a single handler", () => {
  const handler = route.get("/test", { resolve: () => new Response("OK") });
  const handlers = group({ handlers: [handler] });

  assertEquals(handlers.length, 1);
  assertEquals(handlers[0].method, "GET");
  assertEquals(handlers[0].path, "/test");
});

Deno.test("group flattens multiple handlers", () => {
  const handler1 = route.get("/users", {
    resolve: () => new Response("Users"),
  });
  const handler2 = route.post("/users", {
    resolve: () => new Response("Create User"),
  });
  const handlers = group({ handlers: [handler1, handler2] });

  assertEquals(handlers.length, 2);
  assertEquals(handlers[0].method, "GET");
  assertEquals(handlers[0].path, "/users");
  assertEquals(handlers[1].method, "POST");
  assertEquals(handlers[1].path, "/users");
});

Deno.test("group flattens nested handler arrays", () => {
  const userHandlers = [
    route.get("/users", { resolve: () => new Response("Users") }),
    route.post("/users", { resolve: () => new Response("Create User") }),
  ];
  const productHandlers = [
    route.get("/products", { resolve: () => new Response("Products") }),
    route.post("/products", { resolve: () => new Response("Create Product") }),
  ];
  const handlers = group({ handlers: [userHandlers, productHandlers] });

  assertEquals(handlers.length, 4);
  assertEquals(handlers[0].path, "/users");
  assertEquals(handlers[1].path, "/users");
  assertEquals(handlers[2].path, "/products");
  assertEquals(handlers[3].path, "/products");
});

Deno.test("group flattens deeply nested handler groups", () => {
  const userHandlers = [
    route.get("/users", { resolve: () => new Response("Users") }),
    route.post("/users", { resolve: () => new Response("Create User") }),
  ];
  const productHandlers = [
    route.get("/products", { resolve: () => new Response("Products") }),
  ];
  const adminHandlers = group({ handlers: [userHandlers, productHandlers] });
  const publicHandlers = [
    route.get("/", { resolve: () => new Response("Home") }),
  ];
  const allHandlers = group({ handlers: [adminHandlers, publicHandlers] });

  assertEquals(allHandlers.length, 4);
  assertEquals(allHandlers[0].path, "/users");
  assertEquals(allHandlers[1].path, "/users");
  assertEquals(allHandlers[2].path, "/products");
  assertEquals(allHandlers[3].path, "/");
});

Deno.test("group handles mixed single handlers and arrays", () => {
  const userHandlers = [
    route.get("/users", { resolve: () => new Response("Users") }),
    route.post("/users", { resolve: () => new Response("Create User") }),
  ];
  const handlers = group({
    handlers: [
      userHandlers,
      route.get("/products", { resolve: () => new Response("Products") }),
      route.get("/", { resolve: () => new Response("Home") }),
    ],
  });

  assertEquals(handlers.length, 4);
  assertEquals(handlers[0].path, "/users");
  assertEquals(handlers[1].path, "/users");
  assertEquals(handlers[2].path, "/products");
  assertEquals(handlers[3].path, "/");
});

Deno.test("group applies guards to all handlers", () => {
  const authGuard: GuardFn = ({ cookies }) => {
    if (!cookies["session"]) {
      return { deny: new Response("Unauthorized", { status: 401 }) };
    }
    return { allow: true };
  };

  const handlers = group({
    handlers: [
      route.get("/protected", { resolve: () => new Response("Secret") }),
      route.post("/protected/action", {
        resolve: () => new Response("Action"),
      }),
    ],
    guards: [authGuard],
  });

  assertEquals(handlers.length, 2);
  assertEquals(handlers[0].guards?.length, 1);
  assertEquals(handlers[1].guards?.length, 1);
});

Deno.test("group guards are prepended to handler-level guards", () => {
  const groupGuard: GuardFn = () => ({ allow: true });
  const handlerGuard: GuardFn = () => ({ allow: true });

  const handlerWithGuard = route.get("/test", {
    resolve: () => new Response("OK"),
    guards: [handlerGuard],
  });

  const handlers = group({
    handlers: [handlerWithGuard],
    guards: [groupGuard],
  });

  assertEquals(handlers[0].guards?.length, 2);
  assertEquals(handlers[0].guards?.[0], groupGuard);
  assertEquals(handlers[0].guards?.[1], handlerGuard);
});

Deno.test("group guards apply to nested groups", () => {
  const outerGuard: GuardFn = () => ({ allow: true });
  const innerGuard: GuardFn = () => ({ allow: true });

  const innerHandlers = group({
    handlers: [
      route.get("/api/users", { resolve: () => new Response("Users") }),
      route.get("/api/posts", { resolve: () => new Response("Posts") }),
    ],
    guards: [innerGuard],
  });

  const outerHandlers = group({
    handlers: [innerHandlers],
    guards: [outerGuard],
  });

  assertEquals(outerHandlers.length, 2);
  assertEquals(outerHandlers[0].guards?.length, 2);
  assertEquals(outerHandlers[0].guards?.[0], outerGuard);
  assertEquals(outerHandlers[0].guards?.[1], innerGuard);
});
