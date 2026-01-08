import { assertEquals } from "jsr:@std/assert";
import { route, setupNimble, type Validator } from "../mod.ts";

// Simple validator implementations using the new ValidationResult pattern
const uuidValidator: Validator<
  Record<string, string | undefined>,
  { id: string }
> = {
  validate: (params) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const id = params.id;

    if (!id || !uuidRegex.test(id)) {
      return {
        valid: false,
        response: Response.json(
          { error: "Invalid UUID format" },
          { status: 400 },
        ),
      };
    }

    return { valid: true, data: { id } };
  },
};

const emailValidator: Validator<unknown, { email: string }> = {
  validate: (value) => {
    const body = value as any;
    if (!body.email || typeof body.email !== "string") {
      return {
        valid: false,
        response: Response.json(
          { error: "Email is required" },
          { status: 400 },
        ),
      };
    }
    if (!body.email.includes("@")) {
      return {
        valid: false,
        response: Response.json(
          { error: "Invalid email format" },
          { status: 400 },
        ),
      };
    }
    return { valid: true, data: { email: body.email } };
  },
};

Deno.test("validation - params validation success", async () => {
  const handlers = [
    route.get("/users/:id", {
      request: {
        params: uuidValidator,
      },
      resolve: ({ input }: any) => {
        // input.params is validated and typed
        return {
          ok: true,
          response: Response.json({ success: true, id: input.params.id }),
        };
      },
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request(
    "http://localhost/users/550e8400-e29b-41d4-a716-446655440000",
  );
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.id, "550e8400-e29b-41d4-a716-446655440000");
});

Deno.test("validation - params validation failure", async () => {
  const handlers = [
    route.get("/users/:id", {
      request: {
        params: uuidValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/users/invalid-uuid");
  const res = await app.fetch(req);

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Invalid UUID format");
});

Deno.test("validation - query validation success", async () => {
  const queryValidator: Validator<
    Record<string, string | string[]>,
    { limit: number }
  > = {
    validate: (value) => {
      const limit = value.limit;
      const num = typeof limit === "string" ? parseInt(limit, 10) : 0;
      if (isNaN(num) || num < 1 || num > 100) {
        return {
          valid: false,
          response: Response.json(
            { error: "Limit must be between 1 and 100" },
            { status: 400 },
          ),
        };
      }
      return { valid: true, data: { limit: num } };
    },
  };

  const handlers = [
    route.get("/users", {
      request: {
        query: queryValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/users?limit=10");
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
});

Deno.test("validation - query validation failure", async () => {
  const queryValidator: Validator<
    Record<string, string | string[]>,
    { limit: number }
  > = {
    validate: (value) => {
      const limit = value.limit;
      const num = typeof limit === "string" ? parseInt(limit, 10) : 0;
      if (isNaN(num) || num < 1 || num > 100) {
        return {
          valid: false,
          response: Response.json(
            { error: "Limit must be between 1 and 100" },
            { status: 400 },
          ),
        };
      }
      return { valid: true, data: { limit: num } };
    },
  };

  const handlers = [
    route.get("/users", {
      request: {
        query: queryValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/users?limit=500");
  const res = await app.fetch(req);

  assertEquals(res.status, 400);
});

Deno.test("validation - body validation success", async () => {
  const handlers = [
    route.post("/users", {
      request: {
        body: emailValidator,
      },
      resolve: ({ input }: any) => {
        // input.body is validated and typed
        return {
          ok: true,
          response: Response.json({ success: true, email: input.body.email }),
        };
      },
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com" }),
  });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.email, "test@example.com");
});

Deno.test("validation - body validation failure", async () => {
  const handlers = [
    route.post("/users", {
      request: {
        body: emailValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-email" }),
  });
  const res = await app.fetch(req);

  assertEquals(res.status, 400);
});

Deno.test("validation - headers validation success", async () => {
  const headerValidator: Validator<Record<string, string>, { apiKey: string }> =
    {
      validate: (headers) => {
        const apiKey = headers["x-api-key"];
        if (!apiKey || apiKey.length < 32) {
          return {
            valid: false,
            response: Response.json(
              { error: "Invalid API key" },
              { status: 400 },
            ),
          };
        }
        return { valid: true, data: { apiKey } };
      },
    };

  const handlers = [
    route.get("/protected", {
      request: {
        headers: headerValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/protected", {
    headers: {
      "X-API-Key": "a".repeat(32),
    },
  });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
});

Deno.test("validation - headers validation failure", async () => {
  const headerValidator: Validator<Record<string, string>, { apiKey: string }> =
    {
      validate: (headers) => {
        const apiKey = headers["x-api-key"];
        if (!apiKey || apiKey.length < 32) {
          return {
            valid: false,
            response: Response.json(
              { error: "Invalid API key" },
              { status: 400 },
            ),
          };
        }
        return { valid: true, data: { apiKey } };
      },
    };

  const handlers = [
    route.get("/protected", {
      request: {
        headers: headerValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);
  const req = new Request("http://localhost/protected", {
    headers: {
      "X-API-Key": "short",
    },
  });
  const res = await app.fetch(req);

  assertEquals(res.status, 400);
});

Deno.test("validation - multiple validators", async () => {
  const queryValidator: Validator<
    Record<string, string | string[]>,
    { page: number }
  > = {
    validate: (value) => {
      const page = value.page;
      const num = typeof page === "string" ? parseInt(page, 10) : 1;
      if (isNaN(num) || num < 1) {
        return {
          valid: false,
          response: Response.json(
            { error: "Page must be >= 1" },
            { status: 400 },
          ),
        };
      }
      return { valid: true, data: { page: num } };
    },
  };

  const handlers = [
    route.get("/users/:id", {
      request: {
        params: uuidValidator,
        query: queryValidator,
      },
      resolve: () => ({
        ok: true,
        response: Response.json({ success: true }),
      }),
    }),
  ];

  const app = setupNimble(handlers);

  // Both valid
  const req1 = new Request(
    "http://localhost/users/550e8400-e29b-41d4-a716-446655440000?page=2",
  );
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 200);

  // Invalid params
  const req2 = new Request("http://localhost/users/invalid?page=2");
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 400);

  // Invalid query
  const req3 = new Request(
    "http://localhost/users/550e8400-e29b-41d4-a716-446655440000?page=0",
  );
  const res3 = await app.fetch(req3);
  assertEquals(res3.status, 400);
});

// Shorthand examples: Using Zod/Valibot-like schemas directly
// These tests demonstrate the duck-typing feature without requiring actual dependencies

Deno.test("validation - shorthand with Zod-like schema (safeParse)", async () => {
  // Mock Zod-like schema with safeParse
  const zodLikeEmailSchema = {
    safeParse: (value: unknown) => {
      const body = value as any;
      if (!body.email || typeof body.email !== "string") {
        return {
          success: false as const,
          error: { message: "Email is required" },
        };
      }
      if (!body.email.includes("@")) {
        return {
          success: false as const,
          error: { message: "Invalid email format" },
        };
      }
      return {
        success: true as const,
        data: { email: body.email },
      };
    },
  };

  const handlers = [
    route.post("/register", {
      request: {
        body: zodLikeEmailSchema,
      },
      resolve: ({ input }: any) => ({
        ok: true,
        response: Response.json({ email: input.body.email }),
      }),
    }),
  ];

  const app = setupNimble(handlers);

  // Valid email
  const req1 = new Request("http://localhost/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@example.com" }),
  });
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 200);
  const body1 = await res1.json();
  assertEquals(body1.email, "user@example.com");

  // Invalid email
  const req2 = new Request("http://localhost/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid" }),
  });
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 400);
});

Deno.test("validation - shorthand with Valibot-like schema (parse)", async () => {
  // Mock Valibot-like schema with parse that throws
  const valibotLikeAgeSchema = {
    parse: (value: unknown) => {
      const body = value as any;
      if (typeof body.age !== "number") {
        throw new Error("Age must be a number");
      }
      if (body.age < 0 || body.age > 150) {
        throw new Error("Age must be between 0 and 150");
      }
      return { age: body.age };
    },
  };

  const handlers = [
    route.post("/profile", {
      request: {
        body: valibotLikeAgeSchema,
      },
      resolve: ({ input }: any) => ({
        ok: true,
        response: Response.json({ age: input.body.age }),
      }),
    }),
  ];

  const app = setupNimble(handlers);

  // Valid age
  const req1 = new Request("http://localhost/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ age: 25 }),
  });
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 200);
  const body1 = await res1.json();
  assertEquals(body1.age, 25);

  // Invalid age
  const req2 = new Request("http://localhost/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ age: 200 }),
  });
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 400);
});

Deno.test("validation - shorthand params with Zod-like schema", async () => {
  // Mock Zod-like UUID schema
  const zodLikeUUIDSchema = {
    safeParse: (params: Record<string, string | undefined>) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const id = params.id;

      if (!id || !uuidRegex.test(id)) {
        return {
          success: false as const,
          error: { message: "Invalid UUID format" },
        };
      }

      return {
        success: true as const,
        data: { id },
      };
    },
  };

  const handlers = [
    route.get("/items/:id", {
      request: {
        params: zodLikeUUIDSchema,
      },
      resolve: ({ input }: any) => ({
        ok: true,
        response: Response.json({ id: input.params.id }),
      }),
    }),
  ];

  const app = setupNimble(handlers);

  // Valid UUID
  const req1 = new Request(
    "http://localhost/items/550e8400-e29b-41d4-a716-446655440000",
  );
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 200);

  // Invalid UUID
  const req2 = new Request("http://localhost/items/not-a-uuid");
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 400);
});
