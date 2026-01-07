# Nimble Web Framework

A minimal, type-safe web framework built on Web Standards API (`Request`/`Response`/`URLPattern`). Compatible with Deno and Bun runtimes.

---

## Overview

Nimble follows a simple flow:

```
Request → Router (URLPattern matching) → Guards → Handler (with context) → Response
```

**Key Features:**
- Explicit, value-based error handling with `ResolveResult` pattern
- MSW-style handler context with parsed URL, params, cookies, and request ID
- Object-based route configuration with `resolve` handlers
- Guards for authentication, authorization, and request validation
- Handler grouping with composable guards
- `URLPattern`-based routing with path parameters
- Centralized exception handling with custom `onError` handlers
- Zero external dependencies

---

## Quick Start

```ts
import { route, setupNimble } from "@bastianplsfix/nimble";

const handlers = [
  route.get("/", {
    resolve: () => ({
      ok: true,
      response: new Response("Hello, World!"),
    }),
  }),

  route.get("/users/:id", {
    resolve: ({ params }) => {
      const user = findUser(params.id);
      
      if (!user) {
        return {
          ok: false,
          response: Response.json({ error: "Not found" }, { status: 404 }),
        };
      }

      return {
        ok: true,
        response: Response.json(user),
      };
    },
  }),

  route.post("/users", {
    resolve: async ({ request }) => {
      const body = await request.json();
      return {
        ok: true,
        response: Response.json(body, { status: 201 }),
      };
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
| `ResolveResult` | `{ ok: true; response: Response } \| { ok: false; response: Response }` — Explicit semantic intent |
| `HandlerFn` | `(info: ResolverInfo) => ResolveResult \| Promise<ResolveResult>` |
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
      resolve: () => ({
        ok: true,
        response: Response.json({ user: "john" }),
      }),
    }),
    route.put("/profile", {
      resolve: async ({ request }) => {
        const data = await request.json();
        return {
          ok: true,
          response: Response.json({ updated: true }),
        };
      },
    }),
  ],
  guards: [authGuard],  // Applied to all handlers in this group
});
```

---

### Guards

Guards are pure, ordered request gates that either allow execution or return a response. They return structured results:
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
  resolve: ({ params }) => ({
    ok: true,
    response: new Response(`Deleted user ${params.id}`),
  }),
  guards: [authGuard],
});

// Apply guards at group level
const adminHandlers = group({
  handlers: [
    route.post("/admin/stats", {
      resolve: () => ({
        ok: true,
        response: Response.json({ users: 1000 }),
      }),
    }),
  ],
  guards: [authGuard, adminGuard], // Multiple guards execute in order
});
```

**Guard Execution Order (Fixed):**
Guards execute in a **fixed, predictable order**:
1. Outer group guards (outermost first)
2. Inner group guards
3. Route-level guards

**Guard Behavior:**
- Guards execute sequentially in order
- First guard to return `{ deny: Response }` stops execution
- Remaining guards are skipped when a denial occurs
- All `ResolverInfo` properties are **readonly** for immutability

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

#### `setupNimble(config: Handler[] | NimbleConfig)`

Bootstraps the framework with handlers and optional configuration.

**Parameters:**

```ts
// Simple usage: array of handlers
setupNimble(handlers);

// Advanced usage: config object
interface NimbleConfig {
  handlers: Handler[];
  onError?: OnErrorHandler;  // Optional custom error handler
}
```

**Types:**

```ts
interface ErrorContext {
  request: Request;
  requestId: string;
  error: unknown;
}

type OnErrorHandler = (ctx: ErrorContext) => Response | Promise<Response>;
```

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
    return {
      ok: true,
      response: Response.json({ query }),
    };
  },
});

// Read cookies
route.get("/me", {
  resolve: ({ cookies }) => {
    const session = cookies["session_id"];
    return {
      ok: true,
      response: new Response(session ? "Logged in" : "Guest"),
    };
  },
});

// Access request ID for logging
route.get("/api/data", {
  resolve: ({ requestId }) => {
    console.log(`[${requestId}] Fetching data`);
    return {
      ok: true,
      response: Response.json({ data: [1, 2, 3] }),
    };
  },
});

// Wildcard method matching
route.all("/health", {
  resolve: () => ({
    ok: true,
    response: new Response("OK"),
  }),
});

// Custom HTTP method
route.on("PURGE", "/cache", {
  resolve: () => ({
    ok: true,
    response: new Response("Cache cleared"),
  }),
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
    resolve: () => ({
      ok: true,
      response: new Response("Home"),
    }),
  }),
  route.get("/about", {
    resolve: () => ({
      ok: true,
      response: new Response("About"),
    }),
  }),
];

// Protected handlers (require auth)
const userHandlers = group({
  handlers: [
    route.get("/profile", {
      resolve: () => ({
        ok: true,
        response: Response.json({ user: "john" }),
      }),
    }),
    route.put("/profile", {
      resolve: async ({ request }) => {
        const data = await request.json();
        return {
          ok: true,
          response: Response.json({ updated: true }),
        };
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
    return {
      ok: true,
      response: Response.json(data),
    };
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
    return {
      ok: true,
      response: new Response("Logged in", {
        headers: {
          "Set-Cookie": `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=3600`,
        },
      }),
    };
  },
});

route.get("/me", {
  resolve: ({ cookies }) => {
    const sessionId = cookies["session_id"];
    if (!sessionId) {
      return {
        ok: false,
        response: Response.json({ error: "Not authenticated" }, { status: 401 }),
      };
    }
    return {
      ok: true,
      response: Response.json({ user: "john", sessionId }),
    };
  },
});
```

---

## Error Handling and Validation

Nimble's error handling is fully explicit, value-based, and centered around semantic intent rather than HTTP status classes.

### The `ResolveResult` Pattern

Handlers can return a `ResolveResult` to make semantic intent explicit:

```ts
type ResolveResult =
  | { ok: true; response: Response }   // Semantically successful
  | { ok: false; response: Response }  // Expected error
```

- **`ok: true`** = Semantically successful execution (2xx, 3xx redirects)
- **`ok: false`** = Expected error cases (4xx validation, missing resources, domain constraints)

**Why not just use HTTP status codes?**
The `ok` field represents **semantic intent**, not HTTP status ranges. A 301 redirect is `ok: true` because it's deliberate control flow. A 404 is `ok: false` because it represents a failure to find the requested resource.

### Handler Examples with `ResolveResult`

```ts
// Resource lookup with explicit success/failure
route.get("/users/:id", {
  resolve: ({ params }) => {
    const user = findUser(params.id);

    if (!user) {
      return { 
        ok: false, 
        response: Response.json({ error: "User not found" }, { status: 404 }) 
      };
    }

    return { 
      ok: true, 
      response: Response.json(user) 
    };
  },
});

// Validation with explicit failure
route.post("/products", {
  resolve: async ({ request }) => {
    const product = await request.json();

    if (!product.name || !product.price) {
      return { 
        ok: false, 
        response: Response.json(
          { error: "Missing required fields: name and price" }, 
          { status: 400 }
        ) 
      };
    }

    return { 
      ok: true, 
      response: Response.json(
        { id: crypto.randomUUID(), ...product }, 
        { status: 201 }
      ) 
    };
  },
});

// Redirects are semantically successful
route.get("/old-path", {
  resolve: () => {
    return { 
      ok: true,  // Deliberate control flow
      response: Response.redirect("/new-path", 301) 
    };
  },
});
```

### Exception Handling with `onError`

Exceptions are reserved strictly for **unexpected failures**: bugs, crashes, and infrastructure problems.

Guards and handlers **never throw** for expected outcomes. If any part of the pipeline throws an exception, Nimble catches it once at the framework boundary and delegates to a centralized `onError` handler.

**Default behavior:**
```ts
// Logs the error and returns a sanitized 500 response
const app = setupNimble(handlers);
```

**Custom error handler:**
```ts
const app = setupNimble({
  handlers,
  onError: ({ request, requestId, error }) => {
    // Log to monitoring service (Sentry, DataDog, etc.)
    logger.error({
      requestId,
      error,
      url: request.url,
      method: request.method,
    });

    // Return sanitized response (never leak error details)
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  },
});
```

### Philosophy

1. **Validation is part of the contract** - Not an exceptional condition
2. **Expected outcomes return values** - Guards return `{ allow }` or `{ deny }`, handlers return `Response` or `ResolveResult`
3. **Exceptions = bugs** - Thrown errors are treated as unexpected failures and handled centrally
4. **Explicit control flow** - The `ok` field makes semantic intent visible and deterministic
5. **No hidden short-circuiting** - All control flow is explicit and readable

This creates a framework where the request lifecycle is deterministic and readable. From the route definition alone, you can understand what data is required, which conditions can end the request early, which responses are intentionally produced, and which failures are considered exceptional.

---

## License

MIT
