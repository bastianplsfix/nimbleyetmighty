import {
  group,
  type GuardFn,
  route,
  setupNimble,
} from "../../packages/core/mod.ts";
import { z } from "zod";

// ============================================================================
// Guards
// ============================================================================

const requireAuth: GuardFn = (c) => {
  const apiKey = c.req.headers.get("x-api-key");

  if (!apiKey || apiKey !== "secret-key-123") {
    return {
      deny: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    allow: true,
    locals: {
      userId: "user-123",
      role: "admin",
    },
  };
};

// ============================================================================
// Routes
// ============================================================================

const healthHandler = route.get("/health", {
  resolve: () => {
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  },
});

const rootHandler = route.get("/", {
  resolve: (c) => {
    return Response.json({
      message: "Welcome to Nimble!",
      requestId: c.locals.requestId,
    });
  },
});

const getUserHandler = route.get("/users/:id", {
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid params", issues: c.input.issues },
        { status: 400 },
      );
    }

    const { id } = c.input.params as { id: string };
    return Response.json({
      id,
      name: "John Doe",
      email: "john@example.com",
    });
  },
});

const listUsersHandler = route.get("/users", {
  request: {
    query: z.object({
      limit: z.string().transform(Number),
      page: z.string().transform(Number),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid query", issues: c.input.issues },
        { status: 400 },
      );
    }

    const { limit, page } = c.input.query as { limit: number; page: number };
    return Response.json({
      users: [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ],
      pagination: { page, limit, total: 100 },
    });
  },
});

const createUserHandler = route.post("/users", {
  request: {
    body: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid body", issues: c.input.issues },
        { status: 400 },
      );
    }

    const body = c.input.body as { name: string; email: string };
    return Response.json(
      {
        id: crypto.randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  },
});

const searchHandler = route.get("/search", {
  resolve: (c) => {
    const tags = c.raw.query.tag;
    const category = c.raw.query.category;

    return Response.json({
      query: {
        tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
        category,
      },
      results: [],
    });
  },
});

const protectedHandler = route.get("/protected", {
  resolve: (c) => {
    return Response.json({
      message: "Protected resource",
      user: {
        id: c.locals.userId,
        role: c.locals.role,
      },
    });
  },
});

// ============================================================================
// Setup
// ============================================================================

const publicRoutes = [
  healthHandler,
  rootHandler,
  listUsersHandler,
  getUserHandler,
  searchHandler,
];

const protectedRoutes = group({
  guards: [requireAuth],
  handlers: [
    protectedHandler,
    createUserHandler,
  ],
});

const app = setupNimble({
  handlers: [
    ...publicRoutes,
    ...protectedRoutes,
  ],

  onRequest: (req) => {
    const requestId = req.headers.get("x-request-id") ||
      crypto.randomUUID();
    return { requestId };
  },

  onResponse: (req, res) => {
    const requestId = req.headers.get("x-request-id") ||
      crypto.randomUUID();
    const headers = new Headers(res.headers);
    headers.set("x-request-id", requestId);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  },
});

Deno.serve({ port: 8000 }, app.fetch);
