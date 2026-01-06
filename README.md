# Nimble Web Framework

A minimal, type-safe web framework built on Web Standards API (`Request`/`Response`/`URLPattern`). Compatible with Deno and Bun runtimes.

---

## Overview

Nimble follows a simple flow:

```
Request → Router (URLPattern matching) → Guards → Handler (with context) → Response
```

**Key Features:**
- MSW-style handler context with parsed URL, params, cookies, and request ID
- Object-based route configuration with `resolve` handlers
- Guard middleware for authentication, authorization, and request validation
- Handler grouping with composable guards
- `URLPattern`-based routing with path parameters
- Zero external dependencies

---

## Quick Start

```ts
import { route, setupNimble } from "@bastianplsfix/nimble";

const handlers = [
  route.get("/", {
    resolve: () => new Response("Hello, World!"),
  }),

  route.get("/users/:id", {
    resolve: ({ params }) => {
      return Response.json({ userId: params.id });
    },
  }),

  route.post("/users", {
    resolve: async ({ request }) => {
      const body = await request.json();
      return Response.json(body, { status: 201 });
    },
  }),
];

const app = setupNimble(handlers);

// Deno
Deno.serve(app.fetch);

// Bun
export default app;
```

---

## API Reference

### `route.ts`

#### Types

| Type | Description |
|------|-------------|
| `RouteParams` | `Record<string, string \| undefined>` — Path parameters extracted from URL |
| `ResolverInfo` | Context object passed to handlers and guards |
| `HandlerFn` | `(info: ResolverInfo) => Response \| Promise<Response>` |
| `GuardFn` | `(info: ResolverInfo) => GuardResult \| Promise<GuardResult>` |
| `GuardResult` | `{ allow: true } \| { deny: Response }` — Structured guard return type |
| `RouteConfig` | Route configuration: `{ resolve, guards? }` |
| `Handler` | Route descriptor: `{ method, path, handler, guards? }` |

#### `ResolverInfo`

```ts
interface ResolverInfo {
  request: Request;                    // Original request object
  requestId: string;                   // Unique request ID (from headers or generated)
  params: RouteParams;                 // Path parameters (e.g., { id: "123" })
  cookies: Record<string, string>;     // Parsed cookies
}
```

#### `RouteConfig`

```ts
interface RouteConfig {
  resolve: HandlerFn;      // Handler function
  guards?: GuardFn[];      // Optional guards to run before handler
}
```

#### `route` Factory

| Method | Signature |
|--------|-----------|
| `route.get` | `(path: string, config: RouteConfig) => Handler` |
| `route.head` | `(path: string, config: RouteConfig) => Handler` |
| `route.post` | `(path: string, config: RouteConfig) => Handler` |
| `route.put` | `(path: string, config: RouteConfig) => Handler` |
| `route.patch` | `(path: string, config: RouteConfig) => Handler` |
| `route.delete` | `(path: string, config: RouteConfig) => Handler` |
| `route.options` | `(path: string, config: RouteConfig) => Handler` |
| `route.all` | `(path: string, config: RouteConfig) => Handler` — Matches any method |
| `route.on` | `(method: string, path: string, config: RouteConfig) => Handler` — Custom method |

---

### `group.ts`

#### `group(options: GroupOptions)`

Compose multiple handlers or handler groups into a flat array. Guards from groups are applied to all handlers.

```ts
interface GroupOptions {
  handlers: HandlerGroup[];   // Array of handlers, arrays, or nested groups
  guards?: GuardFn[];         // Optional guards applied to all handlers
}
```

**Example:**

```ts
const protectedHandlers = group({
  handlers: [
    route.get("/profile", {
      resolve: () => Response.json({ user: "john" }),
    }),
    route.put("/profile", {
      resolve: async ({ request }) => {
        const data = await request.json();
        return Response.json({ updated: true });
      },
    }),
  ],
  guards: [authGuard],  // Applied to all handlers in this group
});
```

---

### Guards

Guards are middleware functions that run before handlers. They return structured results:
- **Allow requests:** `return { allow: true }`
- **Deny requests:** `return { deny: Response }`
- Support async operations
- Access the same `ResolverInfo` as handlers

**Example:**

```ts
import { type GuardFn } from "@bastianplsfix/nimble";

const authGuard: GuardFn = ({ cookies }) => {
  if (!cookies["session_id"]) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { allow: true };
};

const adminGuard: GuardFn = ({ cookies }) => {
  const session = cookies["session_id"];
  if (session !== "admin-session") {
    return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { allow: true };
};

// Apply guards at route level
route.delete("/users/:id", {
  resolve: ({ params }) => new Response(`Deleted user ${params.id}`),
  guards: [authGuard],
});

// Apply guards at group level
const adminHandlers = group({
  handlers: [
    route.post("/admin/stats", {
      resolve: () => Response.json({ users: 1000 }),
    }),
  ],
  guards: [authGuard, adminGuard], // Multiple guards execute in order
});
```

**Guard Execution:**
- Guards execute sequentially in the order they're defined
- First guard to return `{ deny: Response }` stops execution
- Group guards execute before route-level guards
- Outer group guards execute before inner group guards

---

### `router.ts`

#### `createRouter(handlers: Handler[])`

Creates a router instance.

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `match` | `(method: string, url: string) => RouteMatch \| null` | Find matching route |
| `handle` | `(req: Request) => Promise<Response>` | Handle a request |

```ts
interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}
```

---

### `runtime.ts`

#### `setupNimble(handlers: Handler[])`

Bootstraps the framework with an array of handlers.

**Returns:**

```ts
{
  fetch: (req: Request) => Promise<Response>
}
```

---

## Routing Patterns

Uses the [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) syntax:

| Pattern | Example Match | `params` |
|---------|---------------|----------|
| `/users/:id` | `/users/42` | `{ id: "42" }` |
| `/files/*` | `/files/a/b/c` | `{ "0": "a/b/c" }` |
| `/posts/:slug?` | `/posts` or `/posts/hello` | `{ slug: undefined }` or `{ slug: "hello" }` |

---

## Handler Examples

```ts
// Access query parameters
route.get("/search", {
  resolve: ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    return Response.json({ query });
  },
});

// Read cookies
route.get("/me", {
  resolve: ({ cookies }) => {
    const session = cookies["session_id"];
    return new Response(session ? "Logged in" : "Guest");
  },
});

// Access request ID for logging
route.get("/api/data", {
  resolve: ({ requestId }) => {
    console.log(`[${requestId}] Fetching data`);
    return Response.json({ data: [1, 2, 3] });
  },
});

// Wildcard method matching
route.all("/health", {
  resolve: () => new Response("OK"),
});

// Custom HTTP method
route.on("PURGE", "/cache", {
  resolve: () => new Response("Cache cleared"),
});
```

---

## Advanced: Composing Handler Groups

```ts
import { route, group, type GuardFn } from "@bastianplsfix/nimble";

// Define guards
const authGuard: GuardFn = ({ cookies }) => {
  if (!cookies["session_id"]) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { allow: true };
};

// Public handlers (no guards)
const publicHandlers = [
  route.get("/", {
    resolve: () => new Response("Home"),
  }),
  route.get("/about", {
    resolve: () => new Response("About"),
  }),
];

// Protected handlers (require auth)
const userHandlers = group({
  handlers: [
    route.get("/profile", {
      resolve: () => Response.json({ user: "john" }),
    }),
    route.put("/profile", {
      resolve: async ({ request }) => {
        const data = await request.json();
        return Response.json({ updated: true });
      },
    }),
  ],
  guards: [authGuard],
});

// Compose everything
const app = setupNimble(group({
  handlers: [publicHandlers, userHandlers],
}));
```

---

## Request ID Tracking

Nimble automatically extracts or generates request IDs for distributed tracing:

1. `traceparent` header (W3C Trace Context)
2. `x-request-id` header
3. `x-correlation-id` header
4. Generated UUID (fallback)

```ts
route.get("/api/data", {
  resolve: async ({ requestId }) => {
    console.log(`[${requestId}] Request started`);
    const data = await fetchData();
    console.log(`[${requestId}] Request completed`);
    return Response.json(data);
  },
});
```

---

## Cookies

Cookies are automatically parsed and available in `ResolverInfo`:

```ts
route.post("/login", {
  resolve: () => {
    const sessionId = crypto.randomUUID();
    return new Response("Logged in", {
      headers: {
        "Set-Cookie": `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=3600`,
      },
    });
  },
});

route.get("/me", {
  resolve: ({ cookies }) => {
    const sessionId = cookies["session_id"];
    if (!sessionId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    return Response.json({ user: "john", sessionId });
  },
});
```

---

## License

MIT
