import { assertEquals } from "@std/assert";
import { route, type Schema, setupNimble } from "../mod.ts";

// Mock schema implementation for testing
function createSchema<T>(validate: (data: unknown) => T | null): Schema<T> {
  return {
    safeParse: (data: unknown) => {
      try {
        const result = validate(data);
        if (result === null) {
          return {
            success: false,
            error: {
              issues: [{ path: [], message: "Validation failed" }],
            },
          };
        }
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            issues: [{ path: [], message: String(error) }],
          },
        };
      }
    },
  };
}

Deno.test("validation: no schemas means c.input.ok is always true", async () => {
  const app = setupNimble([
    route.get("/test", {
      resolve: (c) => {
        assertEquals(c.input.ok, true);
        return new Response("OK");
      },
    }),
  ]);

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
});

Deno.test("validation: successful params validation", async () => {
  const paramsSchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") return null;
    return { id: d.id };
  });

  const app = setupNimble([
    route.get("/users/:id", {
      request: {
        params: paramsSchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }
        const params = c.input.params as { id: string };
        return Response.json({ userId: params.id });
      },
    }),
  ]);

  const res = await app.fetch(new Request("http://localhost/users/123"));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { userId: "123" });
});

Deno.test("validation: failed params validation", async () => {
  const paramsSchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    // Require id to be numeric
    if (typeof d.id !== "string" || !/^\d+$/.test(d.id)) return null;
    return { id: parseInt(d.id) };
  });

  const app = setupNimble([
    route.get("/users/:id", {
      request: {
        params: paramsSchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json(
            { error: "Validation failed", issues: c.input.issues },
            { status: 400 },
          );
        }
        const params = c.input.params as { id: number };
        return Response.json({ userId: params.id });
      },
    }),
  ]);

  const res = await app.fetch(new Request("http://localhost/users/abc"));
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "Validation failed");
});

Deno.test("validation: successful query validation", async () => {
  const querySchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.limit !== "string") return null;
    return { limit: parseInt(d.limit) };
  });

  const app = setupNimble([
    route.get("/posts", {
      request: {
        query: querySchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }
        const query = c.input.query as { limit: number };
        return Response.json({ limit: query.limit });
      },
    }),
  ]);

  const res = await app.fetch(new Request("http://localhost/posts?limit=10"));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { limit: 10 });
});

Deno.test("validation: query handles arrays", async () => {
  const app = setupNimble([
    route.get("/search", {
      resolve: (c) => {
        // c.raw.query should have arrays for duplicate params
        const tags = c.raw.query.tag;
        return Response.json({ tags });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/search?tag=a&tag=b&tag=c"),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { tags: ["a", "b", "c"] });
});

Deno.test("validation: successful body validation", async () => {
  const bodySchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.name !== "string" || typeof d.age !== "number") return null;
    return { name: d.name, age: d.age };
  });

  const app = setupNimble([
    route.post("/users", {
      request: {
        body: bodySchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }
        return Response.json({ created: c.input.body });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", age: 30 }),
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { created: { name: "Alice", age: 30 } });
});

Deno.test("validation: failed body validation", async () => {
  const bodySchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.name !== "string" || typeof d.age !== "number") return null;
    return { name: d.name, age: d.age };
  });

  const app = setupNimble([
    route.post("/users", {
      request: {
        body: bodySchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json(
            { error: "Invalid body", failed: c.input.failed },
            { status: 400 },
          );
        }
        return Response.json({ created: c.input.body });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", age: "thirty" }), // age is string, not number
    }),
  );
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "Invalid body");
  assertEquals(json.failed, ["body"]);
});

Deno.test("validation: multiple schema validations", async () => {
  const paramsSchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") return null;
    return { id: d.id };
  });

  const querySchema = createSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.include !== "string") return null;
    return { include: d.include };
  });

  const app = setupNimble([
    route.get("/posts/:id", {
      request: {
        params: paramsSchema,
        query: querySchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json(
            { error: "Validation failed", failed: c.input.failed },
            { status: 400 },
          );
        }
        const params = c.input.params as { id: string };
        const query = c.input.query as { include: string };
        return Response.json({
          postId: params.id,
          include: query.include,
        });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/posts/42?include=comments"),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { postId: "42", include: "comments" });
});

Deno.test("validation: invalid JSON body returns undefined", async () => {
  const app = setupNimble([
    route.post("/data", {
      resolve: (c) => {
        // Invalid JSON should result in undefined body
        return Response.json({ hasBody: c.raw.body !== undefined });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { hasBody: false });
});

Deno.test("validation: c.input.raw contains raw values on failure", async () => {
  const paramsSchema = createSchema(() => null); // Always fails

  const app = setupNimble([
    route.get("/test/:id", {
      request: {
        params: paramsSchema,
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({
            rawParams: c.input.raw.params,
            failed: c.input.failed,
          });
        }
        return new Response("OK");
      },
    }),
  ]);

  const res = await app.fetch(new Request("http://localhost/test/123"));
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.rawParams, { id: "123" });
  assertEquals(json.failed, ["params"]);
});

Deno.test("validation: body parsed even without schema", async () => {
  const app = setupNimble([
    route.post("/data", {
      // No body schema defined, but body should still be parsed
      resolve: (c) => {
        // Body is parsed and cached in c.raw.body
        return Response.json({
          hasBody: c.raw.body !== undefined,
          bodyData: c.raw.body,
        });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "test" }),
    }),
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.hasBody, true);
  assertEquals(json.bodyData, { data: "test" });
});

Deno.test("validation: body parsed when body schema defined", async () => {
  const bodySchema = createSchema((data: unknown) => {
    return data; // Accept anything
  });

  const app = setupNimble([
    route.post("/data", {
      request: {
        body: bodySchema,
      },
      resolve: (c) => {
        // Body should be parsed since schema is defined
        return Response.json({
          hasBody: c.raw.body !== undefined,
          bodyData: c.raw.body,
        });
      },
    }),
  ]);

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "test" }),
    }),
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.hasBody, true);
  assertEquals(json.bodyData, { data: "test" });
});
