import {
  group,
  type GuardFn,
  route,
  setupNimble,
  type ValidatorAdapter,
} from "@bastianplsfix/nimble";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Adapter (Zod)
// ─────────────────────────────────────────────────────────────

const zodAdapter: ValidatorAdapter = {
  parse(schema, data) {
    const result = (schema as z.ZodType).safeParse(data);
    if (result.success) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      errors: result.error.errors.map((e) => ({
        path: e.path.map(String),
        message: e.message,
      })),
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Guards (Middleware)
// ─────────────────────────────────────────────────────────────

// Guards are functions that can allow or reject requests
// They run before handlers and can check authentication, authorization, etc.

// Authentication guard - checks for session cookie
const authGuard: GuardFn = ({ cookies }) => {
  if (!cookies["session_id"]) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { allow: true };
};

// Admin guard - checks for admin role (simplified example)
const adminGuard: GuardFn = ({ cookies }) => {
  const sessionId = cookies["session_id"];
  // In a real app, you'd validate the session and check permissions
  if (sessionId !== "admin-session") {
    return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { allow: true };
};

// Rate limiting guard example
const rateLimitGuard: GuardFn = ({ request }) => {
  // In a real app, you'd track requests per IP/user
  const userAgent = request.headers.get("user-agent");
  if (userAgent?.includes("bot")) {
    return { deny: new Response("Too many requests", { status: 429 }) };
  }
  return { allow: true };
};

// ─────────────────────────────────────────────────────────────
// Handler Groups (Composition)
// ─────────────────────────────────────────────────────────────

// Organize related handlers into groups
const userHandlers = [
  route.get("/users", {
    resolve: () => ({
      ok: true,
      response: Response.json([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]),
    }),
  }),

  route.get("/users/:id", {
    resolve: ({ params }) => {
      // Simulate fetching a user
      const user = params.id === "1"
        ? { id: "1", name: "Alice", email: "alice@example.com" }
        : null;

      // Use ResolveResult pattern to make semantic intent explicit
      if (!user) {
        return {
          ok: false,
          response: Response.json({ error: "User not found" }, { status: 404 }),
        };
      }

      return { ok: true, response: Response.json(user) };
    },
  }),

  route.post("/users", {
    input: {
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    },
    resolve: ({ input, requestId }) => {
      if (!input.ok) {
        return {
          ok: false,
          response: Response.json({ errors: input.errors }, { status: 400 }),
        };
      }

      const user = input.body as { name: string; email: string };
      console.log(`[${requestId}] Creating user:`, user);
      return {
        ok: true,
        response: Response.json({ id: crypto.randomUUID(), ...user }, {
          status: 201,
        }),
      };
    },
  }),

  route.head("/users/:id", {
    resolve: () => ({
      ok: true,
      response: new Response(null, { headers: { "Content-Length": "42" } }),
    }),
  }),
];

const productHandlers = [
  route.get("/products", {
    resolve: () => ({
      ok: true,
      response: Response.json([
        { id: 1, name: "Widget", price: 19.99 },
        { id: 2, name: "Gadget", price: 29.99 },
      ]),
    }),
  }),

  route.get("/products/:id", {
    resolve: ({ params }) => ({
      ok: true,
      response: Response.json({
        productId: params.id,
        name: "Sample Product",
        price: 19.99,
      }),
    }),
  }),

  route.post("/products", {
    input: {
      body: z.object({
        name: z.string().min(1),
        price: z.number().positive(),
      }),
    },
    resolve: ({ input }) => {
      if (!input.ok) {
        return {
          ok: false,
          response: Response.json({ errors: input.errors }, { status: 400 }),
        };
      }

      const product = input.body as { name: string; price: number };
      return {
        ok: true,
        response: Response.json(
          { id: crypto.randomUUID(), ...product },
          { status: 201 },
        ),
      };
    },
  }),
];

const authHandlers = [
  route.post("/login", {
    resolve: () => {
      const sessionId = crypto.randomUUID();
      return {
        ok: true,
        response: new Response("Logged in", {
          status: 200,
          headers: {
            "Set-Cookie":
              `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=3600`,
          },
        }),
      };
    },
  }),

  route.post("/logout", {
    resolve: () => ({
      ok: true,
      response: new Response("Logged out", {
        status: 200,
        headers: {
          "Set-Cookie": "session_id=; HttpOnly; Path=/; Max-Age=0",
        },
      }),
    }),
  }),

  route.get("/me", {
    resolve: ({ cookies }) => {
      const sessionId = cookies["session_id"];

      if (!sessionId) {
        return {
          ok: false,
          response: Response.json({ error: "Not authenticated" }, {
            status: 401,
          }),
        };
      }

      return {
        ok: true,
        response: Response.json({
          user: "john_doe",
          sessionId,
        }),
      };
    },
  }),
];

// Protected user handlers - require authentication
const protectedUserHandlers = group({
  handlers: [
    route.put("/users/:id", {
      resolve: ({ params }) => ({
        ok: true,
        response: new Response(`Updated user ${params.id}`),
      }),
    }),
    route.patch("/users/:id", {
      resolve: ({ params }) => ({
        ok: true,
        response: new Response(`Patched user ${params.id}`),
      }),
    }),
    route.delete("/users/:id", {
      resolve: ({ params }) => ({
        ok: true,
        response: new Response(`Deleted user ${params.id}`),
      }),
    }),
  ],
  guards: [authGuard], // All these routes require authentication
});

// Admin-only handlers - require both auth and admin role
const adminHandlers = group({
  handlers: [
    route.post("/admin/users/bulk-delete", {
      resolve: () => ({
        ok: true,
        response: Response.json({ deleted: 10 }),
      }),
    }),
    route.get("/admin/stats", {
      resolve: () => ({
        ok: true,
        response: Response.json({ users: 1000, products: 500 }),
      }),
    }),
  ],
  guards: [authGuard, adminGuard], // Require both authentication and admin
});

// Compose multiple groups together
const apiHandlers = group({
  handlers: [
    userHandlers,
    productHandlers,
    authHandlers,
    protectedUserHandlers,
    adminHandlers,
  ],
});

const app = setupNimble({
  validator: zodAdapter,
  handlers: [
    // ─────────────────────────────────────────────────────────────
    // Basic Routes
    // ─────────────────────────────────────────────────────────────

    route.get("/", {
      resolve: () => ({
        ok: true,
        response: new Response("Hello from Nimble!"),
      }),
    }),

    route.get("/health", {
      resolve: () => ({
        ok: true,
        response: new Response("OK"),
      }),
    }),

    // ─────────────────────────────────────────────────────────────
    // Composed API Handlers
    // ─────────────────────────────────────────────────────────────

    // Include all grouped handlers
    ...apiHandlers,

    // ─────────────────────────────────────────────────────────────
    // Request Body
    // ─────────────────────────────────────────────────────────────

    route.post("/echo", {
      resolve: async ({ request }) => {
        const body = await request.text();
        return {
          ok: true,
          response: new Response(body),
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // JSON Response
    // ─────────────────────────────────────────────────────────────

    route.get("/json", {
      resolve: () => ({
        ok: true,
        response: Response.json({ hello: "world" }),
      }),
    }),

    // ─────────────────────────────────────────────────────────────
    // Path Parameters
    // ─────────────────────────────────────────────────────────────

    route.get("/users/:userId/posts/:postId", {
      input: {
        params: z.object({
          userId: z.string().uuid(),
          postId: z.string().uuid(),
        }),
      },
      resolve: ({ params, input }) => {
        if (!input.ok) {
          return {
            ok: false,
            error: new Response("Invalid input", { status: 400 }),
          };
        }

        return {
          ok: true,
          response: Response.json({
            userId: input.params.postId,
            postId: params.postId,
          }),
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // Query Parameters (with validation)
    // ─────────────────────────────────────────────────────────────

    route.get("/search", {
      input: {
        query: z.object({
          q: z.string().min(1),
          page: z.coerce.number().positive().default(1),
          limit: z.coerce.number().positive().max(100).default(20),
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

        // input.query is now properly typed with autocomplete!
        const { q, page, limit } = input.query;

        return {
          ok: true,
          response: Response.json({
            query: q,
            page,
            limit,
            results: [],
          }),
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // Cookies (handled by authHandlers group above)
    // ─────────────────────────────────────────────────────────────
    // See /login, /logout, and /me routes in authHandlers

    // ─────────────────────────────────────────────────────────────
    // Request ID (tracing/logging)
    // ─────────────────────────────────────────────────────────────

    // requestId is resolved from:
    // 1. traceparent header (W3C Trace Context)
    // 2. x-request-id header
    // 3. x-correlation-id header
    // 4. Generated UUID (fallback)

    route.get("/trace", {
      resolve: ({ requestId }) => {
        console.log(`[${requestId}] Processing trace request`);
        return {
          ok: true,
          response: Response.json({ requestId }),
        };
      },
    }),

    route.get("/api/data", {
      resolve: async ({ requestId }) => {
        const start = performance.now();

        // Log incoming request
        console.log(`[${requestId}] GET /api/data started`);

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 100));

        const duration = performance.now() - start;
        console.log(
          `[${requestId}] GET /api/data completed in ${duration.toFixed(2)}ms`,
        );

        return {
          ok: true,
          response: Response.json({
            requestId,
            data: [1, 2, 3],
            meta: { duration: `${duration.toFixed(2)}ms` },
          }),
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // Headers
    // ─────────────────────────────────────────────────────────────

    route.get("/headers", {
      resolve: ({ request }) => {
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          ok: true,
          response: Response.json(headers),
        };
      },
    }),

    route.get("/user-agent", {
      resolve: ({ request }) => {
        const userAgent = request.headers.get("user-agent") ?? "Unknown";
        return {
          ok: true,
          response: new Response(userAgent),
        };
      },
    }),

    route.options("/api", {
      resolve: () => ({
        ok: true,
        response: new Response(null, {
          headers: {
            "Allow": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
      }),
    }),

    // ─────────────────────────────────────────────────────────────
    // Wildcard Routes
    // ─────────────────────────────────────────────────────────────

    // Match any HTTP method
    route.all("/wildcard", {
      resolve: ({ request }) => ({
        ok: true,
        response: new Response(`Received ${request.method} request`),
      }),
    }),

    // Wildcard path segment
    route.get("/files/*", {
      resolve: ({ request }) => {
        const url = new URL(request.url);
        const filePath = url.pathname.replace("/files/", "");
        return {
          ok: true,
          response: new Response(`Requested file: ${filePath}`),
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // Custom HTTP Methods
    // ─────────────────────────────────────────────────────────────

    route.on("PROPFIND", "/webdav", {
      resolve: () => ({
        ok: true,
        response: new Response("WebDAV PROPFIND response"),
      }),
    }),

    route.on("PURGE", "/cache", {
      resolve: ({ requestId }) => {
        console.log(`[${requestId}] Cache purge requested`);
        return {
          ok: true,
          response: new Response("Cache cleared"),
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // Error Handling
    // ─────────────────────────────────────────────────────────────

    route.get("/error", {
      resolve: () => ({
        ok: false,
        response: Response.json(
          { error: "Something went wrong" },
          { status: 500 },
        ),
      }),
    }),

    route.get("/not-found-example", {
      resolve: () => ({
        ok: false,
        response: Response.json(
          { error: "Resource not found" },
          { status: 404 },
        ),
      }),
    }),

    // ─────────────────────────────────────────────────────────────
    // Redirect
    // ─────────────────────────────────────────────────────────────

    route.get("/old-path", {
      resolve: () => {
        // Redirects are semantically successful (ok: true)
        // They represent deliberate, intentional control flow
        return {
          ok: true,
          response: Response.redirect("http://localhost:8000/new-path", 301),
        };
      },
    }),

    route.get("/new-path", {
      resolve: () => ({
        ok: true,
        response: new Response("You've been redirected!"),
      }),
    }),

    // ─────────────────────────────────────────────────────────────
    // Streaming Response
    // ─────────────────────────────────────────────────────────────

    route.get("/stream", {
      resolve: () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("chunk 1\n"));
            setTimeout(() => {
              controller.enqueue(new TextEncoder().encode("chunk 2\n"));
              controller.close();
            }, 1000);
          },
        });

        return {
          ok: true,
          response: new Response(stream, {
            headers: { "Content-Type": "text/plain" },
          }),
        };
      },
    }),
  ],
});

Deno.serve(app.fetch);
