import { assertEquals } from "@std/assert";
import { group, type GuardFn, route, setupNimble } from "../mod.ts";

Deno.test("guard allows request when returning null", async () => {
  const authGuard: GuardFn = () => null;

  const handlers = group({
    handlers: [
      route.get("/protected", { resolve: () => new Response("Secret") }),
    ],
    guards: [authGuard],
  });

  const app = setupNimble(handlers);
  const response = await app.fetch(new Request("http://localhost/protected"));

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Secret");
});

Deno.test("guard allows request when returning undefined", async () => {
  const authGuard: GuardFn = () => undefined;

  const handlers = group({
    handlers: [
      route.get("/protected", { resolve: () => new Response("Secret") }),
    ],
    guards: [authGuard],
  });

  const app = setupNimble(handlers);
  const response = await app.fetch(new Request("http://localhost/protected"));

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Secret");
});

Deno.test("guard rejects request when returning Response", async () => {
  const authGuard: GuardFn = () =>
    new Response("Unauthorized", { status: 401 });

  const handlers = group({
    handlers: [
      route.get("/protected", { resolve: () => new Response("Secret") }),
    ],
    guards: [authGuard],
  });

  const app = setupNimble(handlers);
  const response = await app.fetch(new Request("http://localhost/protected"));

  assertEquals(response.status, 401);
  assertEquals(await response.text(), "Unauthorized");
});

Deno.test("guard has access to cookies", async () => {
  const authGuard: GuardFn = ({ cookies }) => {
    if (!cookies["session"]) {
      return new Response("Unauthorized", { status: 401 });
    }
    return null;
  };

  const handlers = group({
    handlers: [
      route.get("/protected", { resolve: () => new Response("Secret") }),
    ],
    guards: [authGuard],
  });

  const app = setupNimble(handlers);

  // Without cookie
  const response1 = await app.fetch(new Request("http://localhost/protected"));
  assertEquals(response1.status, 401);

  // With cookie
  const response2 = await app.fetch(
    new Request("http://localhost/protected", {
      headers: { Cookie: "session=abc123" },
    }),
  );
  assertEquals(response2.status, 200);
  assertEquals(await response2.text(), "Secret");
});

Deno.test("guard has access to request params", async () => {
  let capturedUserId: string | undefined;

  const paramGuard: GuardFn = ({ params }) => {
    capturedUserId = params.id;
    return null;
  };

  const handlers = group({
    handlers: [
      route.get("/users/:id", { resolve: () => new Response("User") }),
    ],
    guards: [paramGuard],
  });

  const app = setupNimble(handlers);
  await app.fetch(new Request("http://localhost/users/123"));

  assertEquals(capturedUserId, "123");
});

Deno.test("guard has access to request object", async () => {
  const methodGuard: GuardFn = ({ request }) => {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    return null;
  };

  const handlers = group({
    handlers: [route.all("/test", { resolve: () => new Response("OK") })],
    guards: [methodGuard],
  });

  const app = setupNimble(handlers);

  const getResponse = await app.fetch(new Request("http://localhost/test"));
  assertEquals(getResponse.status, 200);

  const postResponse = await app.fetch(
    new Request("http://localhost/test", { method: "POST" }),
  );
  assertEquals(postResponse.status, 405);
});

Deno.test("multiple guards execute in order", async () => {
  const executionOrder: number[] = [];

  const guard1: GuardFn = () => {
    executionOrder.push(1);
    return null;
  };

  const guard2: GuardFn = () => {
    executionOrder.push(2);
    return null;
  };

  const guard3: GuardFn = () => {
    executionOrder.push(3);
    return null;
  };

  const handlers = group({
    handlers: [route.get("/test", { resolve: () => new Response("OK") })],
    guards: [guard1, guard2, guard3],
  });

  const app = setupNimble(handlers);
  await app.fetch(new Request("http://localhost/test"));

  assertEquals(executionOrder, [1, 2, 3]);
});

Deno.test("guards stop execution on first rejection", async () => {
  const executionOrder: number[] = [];

  const guard1: GuardFn = () => {
    executionOrder.push(1);
    return null;
  };

  const guard2: GuardFn = () => {
    executionOrder.push(2);
    return new Response("Forbidden", { status: 403 });
  };

  const guard3: GuardFn = () => {
    executionOrder.push(3);
    return null;
  };

  const handlers = group({
    handlers: [route.get("/test", { resolve: () => new Response("OK") })],
    guards: [guard1, guard2, guard3],
  });

  const app = setupNimble(handlers);
  const response = await app.fetch(new Request("http://localhost/test"));

  assertEquals(response.status, 403);
  assertEquals(executionOrder, [1, 2]); // guard3 should not execute
});

Deno.test("handler not executed if guard rejects", async () => {
  let handlerExecuted = false;

  const guard: GuardFn = () => new Response("Forbidden", { status: 403 });

  const handlers = group({
    handlers: [
      route.get("/test", {
        resolve: () => {
          handlerExecuted = true;
          return new Response("OK");
        },
      }),
    ],
    guards: [guard],
  });

  const app = setupNimble(handlers);
  await app.fetch(new Request("http://localhost/test"));

  assertEquals(handlerExecuted, false);
});

Deno.test("nested group guards execute outer-first", async () => {
  const executionOrder: string[] = [];

  const outerGuard: GuardFn = () => {
    executionOrder.push("outer");
    return null;
  };

  const innerGuard: GuardFn = () => {
    executionOrder.push("inner");
    return null;
  };

  const innerHandlers = group({
    handlers: [
      route.get("/api/users", { resolve: () => new Response("Users") }),
    ],
    guards: [innerGuard],
  });

  const outerHandlers = group({
    handlers: [innerHandlers],
    guards: [outerGuard],
  });

  const app = setupNimble(outerHandlers);
  await app.fetch(new Request("http://localhost/api/users"));

  assertEquals(executionOrder, ["outer", "inner"]);
});

Deno.test("async guards work correctly", async () => {
  const asyncGuard: GuardFn = async ({ cookies }) => {
    // Simulate async validation (e.g., database check)
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (!cookies["token"]) {
      return new Response("Unauthorized", { status: 401 });
    }
    return null;
  };

  const handlers = group({
    handlers: [
      route.get("/protected", { resolve: () => new Response("Secret") }),
    ],
    guards: [asyncGuard],
  });

  const app = setupNimble(handlers);

  const response1 = await app.fetch(new Request("http://localhost/protected"));
  assertEquals(response1.status, 401);

  const response2 = await app.fetch(
    new Request("http://localhost/protected", {
      headers: { Cookie: "token=valid" },
    }),
  );
  assertEquals(response2.status, 200);
});

Deno.test("guards can be applied to individual routes without group", async () => {
  const authGuard: GuardFn = ({ cookies }) => {
    if (!cookies["session"]) {
      return new Response("Unauthorized", { status: 401 });
    }
    return null;
  };

  const protectedRoute = {
    ...route.get("/protected", { resolve: () => new Response("Secret") }),
    guards: [authGuard],
  };

  const app = setupNimble([
    route.get("/public", { resolve: () => new Response("Public") }),
    protectedRoute,
  ]);

  const publicResponse = await app.fetch(
    new Request("http://localhost/public"),
  );
  assertEquals(publicResponse.status, 200);

  const protectedResponse = await app.fetch(
    new Request("http://localhost/protected"),
  );
  assertEquals(protectedResponse.status, 401);

  const protectedWithCookie = await app.fetch(
    new Request("http://localhost/protected", {
      headers: { Cookie: "session=abc" },
    }),
  );
  assertEquals(protectedWithCookie.status, 200);
});
