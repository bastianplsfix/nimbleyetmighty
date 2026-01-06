import { group, type GuardFn, route, setupNimble } from "@bastianplsfix/nimble";

// ─────────────────────────────────────────────────────────────
// Guards (Middleware)
// ─────────────────────────────────────────────────────────────

// Guards are functions that can allow or reject requests
// They run before handlers and can check authentication, authorization, etc.

// Authentication guard - checks for session cookie
const authGuard: GuardFn = ({ cookies }) => {
  if (!cookies["session_id"]) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Return null/undefined to allow the request
  return null;
};

// Admin guard - checks for admin role (simplified example)
const adminGuard: GuardFn = ({ cookies }) => {
  const sessionId = cookies["session_id"];
  // In a real app, you'd validate the session and check permissions
  if (sessionId !== "admin-session") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
};

// Rate limiting guard example
const rateLimitGuard: GuardFn = ({ request }) => {
  // In a real app, you'd track requests per IP/user
  const userAgent = request.headers.get("user-agent");
  if (userAgent?.includes("bot")) {
    return new Response("Too many requests", { status: 429 });
  }
  return null;
};

// ─────────────────────────────────────────────────────────────
// Handler Groups (Composition)
// ─────────────────────────────────────────────────────────────

// Organize related handlers into groups
const userHandlers = [
  route.get("/users", () =>
    Response.json([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ])),

  route.get("/users/:id", ({ params }) => {
    return Response.json({ userId: params.id });
  }),

  route.post("/users", async ({ request, requestId }) => {
    const user = await request.json();
    console.log(`[${requestId}] Creating user:`, user);
    return Response.json({ id: crypto.randomUUID(), ...user }, { status: 201 });
  }),

  route.head(
    "/users/:id",
    () => new Response(null, { headers: { "Content-Length": "42" } }),
  ),
];

const productHandlers = [
  route.get("/products", () =>
    Response.json([
      { id: 1, name: "Widget", price: 19.99 },
      { id: 2, name: "Gadget", price: 29.99 },
    ])),

  route.get("/products/:id", ({ params }) => {
    return Response.json({
      productId: params.id,
      name: "Sample Product",
      price: 19.99,
    });
  }),

  route.post("/products", async ({ request }) => {
    const product = await request.json();
    return Response.json({ id: crypto.randomUUID(), ...product }, {
      status: 201,
    });
  }),
];

const authHandlers = [
  route.post("/login", () => {
    const sessionId = crypto.randomUUID();
    return new Response("Logged in", {
      status: 200,
      headers: {
        "Set-Cookie": `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=3600`,
      },
    });
  }),

  route.post("/logout", () => {
    return new Response("Logged out", {
      status: 200,
      headers: {
        "Set-Cookie": "session_id=; HttpOnly; Path=/; Max-Age=0",
      },
    });
  }),

  route.get("/me", ({ cookies }) => {
    const sessionId = cookies["session_id"];

    if (!sessionId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    return Response.json({
      user: "john_doe",
      sessionId,
    });
  }),
];

// Protected user handlers - require authentication
const protectedUserHandlers = group({
  handlers: [
    route.put(
      "/users/:id",
      ({ params }) => new Response(`Updated user ${params.id}`),
    ),
    route.patch(
      "/users/:id",
      ({ params }) => new Response(`Patched user ${params.id}`),
    ),
    route.delete(
      "/users/:id",
      ({ params }) => new Response(`Deleted user ${params.id}`),
    ),
  ],
  guards: [authGuard], // All these routes require authentication
});

// Admin-only handlers - require both auth and admin role
const adminHandlers = group({
  handlers: [
    route.post(
      "/admin/users/bulk-delete",
      () => Response.json({ deleted: 10 }),
    ),
    route.get(
      "/admin/stats",
      () => Response.json({ users: 1000, products: 500 }),
    ),
  ],
  guards: [authGuard, adminGuard], // Require both authentication and admin
});

// Compose multiple groups together
const apiHandlers = group([
  userHandlers,
  productHandlers,
  authHandlers,
  protectedUserHandlers,
  adminHandlers,
]);

const app = setupNimble([
  // ─────────────────────────────────────────────────────────────
  // Basic Routes
  // ─────────────────────────────────────────────────────────────

  route.get("/", () => new Response("Hello from Nimble!")),

  route.get("/health", () => new Response("OK")),

  // ─────────────────────────────────────────────────────────────
  // Composed API Handlers
  // ─────────────────────────────────────────────────────────────

  // Include all grouped handlers
  ...apiHandlers,

  // ─────────────────────────────────────────────────────────────
  // Request Body
  // ─────────────────────────────────────────────────────────────

  route.post("/echo", async ({ request }) => {
    const body = await request.text();
    return new Response(body);
  }),

  // ─────────────────────────────────────────────────────────────
  // JSON Response
  // ─────────────────────────────────────────────────────────────

  route.get("/json", () => {
    return Response.json({ hello: "world" });
  }),

  // ─────────────────────────────────────────────────────────────
  // Path Parameters
  // ─────────────────────────────────────────────────────────────

  route.get("/users/:userId/posts/:postId", ({ params }) => {
    return Response.json({
      userId: params.userId,
      postId: params.postId,
    });
  }),

  // ─────────────────────────────────────────────────────────────
  // Query Parameters (via request.url)
  // ─────────────────────────────────────────────────────────────

  route.get("/search", ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const page = url.searchParams.get("page") ?? "1";
    const limit = url.searchParams.get("limit") ?? "10";

    return Response.json({
      query,
      page: parseInt(page),
      limit: parseInt(limit),
      results: [],
    });
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

  route.get("/trace", ({ requestId }) => {
    console.log(`[${requestId}] Processing trace request`);
    return Response.json({ requestId });
  }),

  route.get("/api/data", async ({ requestId }) => {
    const start = performance.now();

    // Log incoming request
    console.log(`[${requestId}] GET /api/data started`);

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    const duration = performance.now() - start;
    console.log(
      `[${requestId}] GET /api/data completed in ${duration.toFixed(2)}ms`,
    );

    return Response.json({
      requestId,
      data: [1, 2, 3],
      meta: { duration: `${duration.toFixed(2)}ms` },
    });
  }),

  // ─────────────────────────────────────────────────────────────
  // Headers
  // ─────────────────────────────────────────────────────────────

  route.get("/headers", ({ request }) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return Response.json(headers);
  }),

  route.get("/user-agent", ({ request }) => {
    const userAgent = request.headers.get("user-agent") ?? "Unknown";
    return new Response(userAgent);
  }),

  route.options("/api", () =>
    new Response(null, {
      headers: {
        "Allow": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })),

  // ─────────────────────────────────────────────────────────────
  // Wildcard Routes
  // ─────────────────────────────────────────────────────────────

  // Match any HTTP method
  route.all(
    "/wildcard",
    ({ request }) => new Response(`Received ${request.method} request`),
  ),

  // Wildcard path segment
  route.get("/files/*", ({ request }) => {
    const url = new URL(request.url);
    const filePath = url.pathname.replace("/files/", "");
    return new Response(`Requested file: ${filePath}`);
  }),

  // ─────────────────────────────────────────────────────────────
  // Custom HTTP Methods
  // ─────────────────────────────────────────────────────────────

  route.on(
    "PROPFIND",
    "/webdav",
    () => new Response("WebDAV PROPFIND response"),
  ),

  route.on("PURGE", "/cache", ({ requestId }) => {
    console.log(`[${requestId}] Cache purge requested`);
    return new Response("Cache cleared");
  }),

  // ─────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────

  route.get("/error", () => {
    return Response.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }),

  route.get("/not-found-example", () => {
    return Response.json(
      { error: "Resource not found" },
      { status: 404 },
    );
  }),

  // ─────────────────────────────────────────────────────────────
  // Redirect
  // ─────────────────────────────────────────────────────────────

  route.get("/old-path", () => {
    return Response.redirect("http://localhost:8000/new-path", 301);
  }),

  route.get("/new-path", () => new Response("You've been redirected!")),

  // ─────────────────────────────────────────────────────────────
  // Streaming Response
  // ─────────────────────────────────────────────────────────────

  route.get("/stream", () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("chunk 1\n"));
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode("chunk 2\n"));
          controller.close();
        }, 1000);
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain" },
    });
  }),
]);

Deno.serve(app.fetch);
