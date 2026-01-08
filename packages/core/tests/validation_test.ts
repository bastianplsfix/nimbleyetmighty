import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { route, setupNimble, type ValidatorAdapter } from "../mod.ts";

// Mock Zod-like validator adapter for testing
const mockValidator: ValidatorAdapter = {
  parse(schema: unknown, data: unknown) {
    const schemaFn = schema as {
      _type: string;
      validate: (
        data: unknown,
      ) => { ok: boolean; data?: unknown; errors?: string[] };
    };

    const result = schemaFn.validate(data);

    if (result.ok) {
      return { ok: true, data: result.data ?? data };
    }

    return {
      ok: false,
      errors: (result.errors ?? ["Validation failed"]).map((msg) => ({
        path: [],
        message: msg,
      })),
    };
  },
};

// Mock schema helpers
function string() {
  return {
    _type: "string",
    validate: (data: unknown) => {
      if (typeof data === "string") {
        return { ok: true, data };
      }
      return { ok: false, errors: ["Expected string"] };
    },
  };
}

function number() {
  return {
    _type: "number",
    validate: (data: unknown) => {
      if (typeof data === "number") {
        return { ok: true, data };
      }
      return { ok: false, errors: ["Expected number"] };
    },
  };
}

function object(shape: Record<string, unknown>) {
  return {
    _type: "object",
    shape,
    validate: (data: unknown) => {
      if (typeof data !== "object" || data === null) {
        return { ok: false, errors: ["Expected object"] };
      }

      const errors: string[] = [];
      const validated: Record<string, unknown> = {};

      for (const [key, schemaValue] of Object.entries(shape)) {
        const value = (data as Record<string, unknown>)[key];
        const schema = schemaValue as {
          validate: (
            data: unknown,
          ) => { ok: boolean; data?: unknown; errors?: string[] };
        };

        const result = schema.validate(value);
        if (result.ok) {
          validated[key] = result.data;
        } else {
          errors.push(...(result.errors ?? [`Invalid ${key}`]));
        }
      }

      if (errors.length > 0) {
        return { ok: false, errors };
      }

      return { ok: true, data: validated };
    },
  };
}

describe("Validation", () => {
  describe("Basic validation", () => {
    it("should validate request body", async () => {
      const handlers = [
        route.post("/users", {
          input: {
            body: object({
              name: string(),
              age: number(),
            }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ user: input.body }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice", age: 30 }),
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.user).toEqual({ name: "Alice", age: 30 });
    });

    it("should reject invalid body", async () => {
      const handlers = [
        route.post("/users", {
          input: {
            body: object({
              name: string(),
              age: number(),
            }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ user: input.body }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice", age: "not-a-number" }),
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.errors).toBeDefined();
      expect(data.errors.length).toBeGreaterThan(0);
    });

    it("should validate query parameters", async () => {
      const handlers = [
        route.get("/search", {
          input: {
            query: object({
              q: string(),
            }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ query: input.query }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/search?q=test");

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.query).toEqual({ q: "test" });
    });

    it("should validate path parameters", async () => {
      const handlers = [
        route.get("/users/:id", {
          input: {
            params: object({
              id: string(),
            }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ params: input.params }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users/123");

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.params).toEqual({ id: "123" });
    });
  });

  describe("Multiple input sources", () => {
    it("should validate body, query, and params together", async () => {
      const handlers = [
        route.put("/users/:id", {
          input: {
            params: object({ id: string() }),
            query: object({ notify: string() }),
            body: object({ name: string() }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({
                params: input.params,
                query: input.query,
                body: input.body,
              }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users/123?notify=true", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice" }),
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.params).toEqual({ id: "123" });
      expect(data.query).toEqual({ notify: "true" });
      expect(data.body).toEqual({ name: "Alice" });
    });

    it("should aggregate errors from multiple sources", async () => {
      const handlers = [
        route.put("/users/:id", {
          input: {
            params: object({ id: number() }),
            body: object({ age: number() }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ ok: true }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users/abc", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ age: "not-a-number" }),
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.errors).toBeDefined();
      // Should have errors from both params and body
      expect(data.errors.length).toBeGreaterThan(0);
    });
  });

  describe("No input schema", () => {
    it("should set input.ok = true with undefined values when no schema", async () => {
      const handlers = [
        route.get("/health", {
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({
                inputOk: true,
                body: input.body,
                query: input.query,
                params: input.params,
              }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers });

      const request = new Request("http://localhost/health");

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.inputOk).toBe(true);
      expect(data.body).toBeUndefined();
      expect(data.query).toBeUndefined();
      expect(data.params).toBeUndefined();
    });
  });

  describe("Partial input schema", () => {
    it("should validate only defined schemas", async () => {
      const handlers = [
        route.post("/users/:id", {
          input: {
            body: object({ name: string() }),
            // query not defined
            // params not defined
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({
                body: input.body,
                query: input.query,
                params: input.params,
              }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users/123?foo=bar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice" }),
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.body).toEqual({ name: "Alice" });
      expect(data.query).toBeUndefined();
      expect(data.params).toBeUndefined();
    });
  });

  describe("Startup validation", () => {
    it("should throw error if input schema used without validator", () => {
      const handlers = [
        route.post("/users", {
          input: {
            body: object({ name: string() }),
          },
          resolve: ({ input }) => {
            return {
              ok: true,
              response: Response.json({ ok: true }),
            };
          },
        }),
      ];

      expect(() => {
        setupNimble({ handlers });
      }).toThrow(/no validator configured/);
    });

    it("should not throw if no input schemas used", () => {
      const handlers = [
        route.get("/health", {
          resolve: () => {
            return {
              ok: true,
              response: Response.json({ ok: true }),
            };
          },
        }),
      ];

      expect(() => {
        setupNimble({ handlers });
      }).not.toThrow();
    });
  });

  describe("Body parsing", () => {
    it("should handle invalid JSON", async () => {
      const handlers = [
        route.post("/users", {
          input: {
            body: object({ name: string() }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ ok: true }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const request = new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "invalid json {",
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.errors).toBeDefined();
      expect(data.errors[0].path).toEqual(["body"]);
    });

    it("should parse form data", async () => {
      const handlers = [
        route.post("/upload", {
          input: {
            body: object({ name: string() }),
          },
          resolve: ({ input }) => {
            if (!input.ok) {
              return {
                ok: false,
                response: Response.json({ errors: input.errors }, {
                  status: 400,
                }),
              };
            }

            return {
              ok: true,
              response: Response.json({ body: input.body }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      const formData = new FormData();
      formData.append("name", "Alice");

      const request = new Request("http://localhost/upload", {
        method: "POST",
        body: formData,
      });

      const response = await app.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.body).toEqual({ name: "Alice" });
    });
  });

  describe("Guards with validation", () => {
    it("should pass validated input to guards", async () => {
      const handlers = [
        route.post("/admin", {
          input: {
            body: object({ action: string() }),
          },
          guards: [
            ({ input }) => {
              if (!input.ok) {
                return {
                  deny: Response.json({ error: "Invalid input" }, {
                    status: 400,
                  }),
                };
              }

              if ((input.body as { action: string }).action === "delete") {
                return {
                  deny: Response.json({ error: "Forbidden" }, { status: 403 }),
                };
              }

              return { allow: true };
            },
          ],
          resolve: () => {
            return {
              ok: true,
              response: Response.json({ ok: true }),
            };
          },
        }),
      ];

      const app = setupNimble({ handlers, validator: mockValidator });

      // Test guard blocking dangerous action
      const request1 = new Request("http://localhost/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });

      const response1 = await app.fetch(request1);
      expect(response1.status).toBe(403);

      // Test guard allowing safe action
      const request2 = new Request("http://localhost/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "view" }),
      });

      const response2 = await app.fetch(request2);
      expect(response2.status).toBe(200);
    });
  });
});
