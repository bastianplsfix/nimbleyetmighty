# Nimble Web Framework

A minimal, type-safe web framework built on Web Standards API (`Request`/`Response`/`URLPattern`). Compatible with Deno and Bun runtimes.

---

## Overview

Nimble follows a simple flow:

```
Request → onRequest → Router (URLPattern matching) → Guards → Handler (with context) → onResponse → Response
```

**Key Features:**
- Explicit, value-based error handling with `ResolveResult` pattern
- MSW-style handler context with parsed URL, params, cookies, and request ID
- Object-based route configuration with `resolve` handlers
- Guards for authentication, authorization, and request validation
- Handler grouping with composable guards
- `URLPattern`-based routing with path parameters
- Lifecycle hooks (`onRequest`, `onResponse`, `onError`) for cross-cutting concerns
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
  onError?: OnErrorHandler;        // Optional custom error handler
  onRequest?: OnRequestHandler;    // Optional request lifecycle hook
  onResponse?: OnResponseHandler;  // Optional response lifecycle hook
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
type OnRequestHandler = (request: Request) => void | Promise<void>;
type OnResponseHandler = (request: Request, response: Response, requestId: string) => Response | Promise<Response>;
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

## Lifecycle Hooks

Nimble provides optional lifecycle hooks for cross-cutting concerns like logging, metrics, and response transformation. Hooks are **opt-in**, **non-invasive**, and designed to complement (not replace) the explicit guard → handler flow.

### Should I use a hook or a guard?

Quick decision tree to help you choose the right tool:

- ✅ Use **`onRequest`** if: Same for ALL routes (logging, metrics, rate limiting)
- ✅ Use **guard** if: Route-specific logic (auth, validation, permissions)
- ✅ Use **`onResponse`** if: Augmenting ALL responses (CORS headers, security headers)
- ✅ Use **handler** if: Business logic specific to this route

**Rule of thumb:** If it applies to every route, use a hook. If it's route-specific, keep it in the route definition (guard or handler).

### Philosophy

Lifecycle hooks solve a specific problem: **cross-cutting concerns that shouldn't pollute route definitions**. They enable observability and response augmentation without disrupting your explicit, value-based request handling.

**Design Principles:**
1. **Optional and non-invasive** - Framework works perfectly without them
2. **Explicit control flow** - Hooks don't short-circuit or hide behavior
3. **Separation of concerns** - Keep route definitions focused on business logic
4. **Immutability where it matters** - Guards/handlers still receive readonly `ResolverInfo`

### Execution Flow

Understanding when hooks run in the request lifecycle:

**Normal request flow:**
```
onRequest → routing → guards → handler → onResponse → Response
```

**When an exception occurs:**
```
onRequest → routing → guards → handler
    ↓ (exception anywhere)
  onError → Response
    ↓
(onResponse is skipped)
```

**Key points:**
- `onRequest` runs first, before any routing
- `onResponse` only runs if no exceptions occur
- `onError` catches exceptions from anywhere in the pipeline
- If `onError` is triggered, `onResponse` is skipped

### Available Hooks

| Hook | When | Use Cases | Return Type |
|------|------|-----------|-------------|
| `onRequest` | Before routing begins | Request logging, metrics, rate limiting | `void \| Promise<void>` |
| `onResponse` | After handler execution, before returning | Response logging, header injection (CORS, security), compression | `Response \| Promise<Response>` |
| `onError` | When an exception is thrown | Error logging, monitoring integration, sanitized error responses | `Response \| Promise<Response>` |

### `onRequest` - Pre-Routing Hook

Runs **before routing begins**. Use for request-level observability and preprocessing.

```ts
const app = setupNimble({
  handlers,
  onRequest: (request) => {
    // Log incoming request
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
    
    // Track metrics
    metrics.increment("http.requests.total", {
      method: request.method,
      path: new URL(request.url).pathname,
    });
  },
});
```

**Characteristics:**
- Returns `void` (observability only - cannot reject requests or return responses early)
- Cannot modify the request (read-only access)
- To reject a request, use a guard instead or throw an exception
- Exceptions here are caught by `onError`

### `onResponse` - Post-Handler Hook

Runs **after handler execution, before returning response**. Use for response transformation and augmentation.

**Example: Just logging (pass-through pattern)**
```ts
const app = setupNimble({
  handlers,
  onResponse: (request, response, requestId) => {
    // Just log - return the response unchanged
    console.log(`[${requestId}] ${request.method} ${request.url} → ${response.status}`);
    return response;
  },
});
```

**Example: Adding headers (transformation pattern)**
```ts
const app = setupNimble({
  handlers,
  onResponse: (request, response, requestId) => {
    // Add security headers
    const headers = new Headers(response.headers);
    headers.set("X-Request-ID", requestId);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    
    // Return augmented response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
```

**Characteristics:**
- Receives the response from guards/handlers
- Can transform or augment the response
- Must return a `Response` object (can be the same one you received)
- Exceptions here are caught by `onError`

### `onError` - Exception Handler

Runs when an **unexpected exception** is thrown anywhere in the pipeline. See [Error Handling](#error-handling-and-validation) for full details.

```ts
const app = setupNimble({
  handlers,
  onError: ({ request, requestId, error }) => {
    // Log to monitoring service
    Sentry.captureException(error, {
      tags: { requestId },
      extra: { url: request.url, method: request.method },
    });

    // Return sanitized response
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  },
});
```

### Complete Example with All Hooks

```ts
import { route, setupNimble } from "@bastianplsfix/nimble";

const handlers = [
  route.get("/users/:id", {
    resolve: ({ params }) => {
      const user = findUser(params.id);
      if (!user) {
        return { ok: false, response: Response.json({ error: "Not found" }, { status: 404 }) };
      }
      return { ok: true, response: Response.json(user) };
    },
  }),
];

const app = setupNimble({
  handlers,
  
  // Track all incoming requests
  onRequest: (request) => {
    const start = performance.now();
    // Store start time for duration tracking (using global Map or similar)
    requestTimings.set(request, start);
  },
  
  // Add headers and log responses
  onResponse: (request, response, requestId) => {
    // Calculate request duration
    const start = requestTimings.get(request);
    const duration = start ? performance.now() - start : 0;
    requestTimings.delete(request);
    
    // Log with duration
    logger.info({
      requestId,
      method: request.method,
      url: request.url,
      status: response.status,
      duration: `${duration.toFixed(2)}ms`,
    });
    
    // Add CORS and security headers
    const headers = new Headers(response.headers);
    headers.set("X-Request-ID", requestId);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Content-Type-Options", "nosniff");
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
  
  // Handle unexpected errors
  onError: ({ request, requestId, error }) => {
    logger.error({ requestId, error, url: request.url });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  },
});
```

### When NOT to Use Hooks

**Don't use hooks for:**
- **Request validation** - Use guards instead (explicit, route-specific)
- **Authentication/Authorization** - Use guards instead (composable, testable)
- **Business logic** - Put it in handlers (where it belongs)
- **Route-specific behavior** - Keep it in the route definition (explicit is better)

**Hooks are for:**
- Logging and metrics (same for all routes)
- Security headers (same for all routes)
- Distributed tracing (same for all routes)
- Error monitoring (same for all routes)

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

## Request Validation

Nimble provides pluggable request validation with full TypeScript support. Validation follows the same explicit `ok` pattern used throughout the framework.

**Key guarantees:**
- **Guards always run**, even if validation fails
- **Guards can deny unauthenticated requests** even when input is invalid
- **Validation errors are only returned if the handler chooses** to return them

**Execution flow:**
```
Request → onRequest → Router → Validation → Guards → Handler → onResponse → Response
```

### Quick Start

**1. Create a validator adapter** (copy-paste, you own it):

```ts
import type { ValidatorAdapter } from "@bastianplsfix/nimble";
import { z } from "zod";

export const zodAdapter: ValidatorAdapter = {
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
```

**2. Configure Nimble with the validator:**

```ts
const app = setupNimble({
  handlers,
  validator: zodAdapter,
});
```

**3. Use validation in routes:**

```ts
import { route, setupNimble } from "@bastianplsfix/nimble";
import { z } from "zod";

route.post("/users", {
  input: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    // input.body is fully typed with autocomplete!
    const { name, email } = input.body;
    return { ok: true, response: Response.json({ name, email }, { status: 201 }) };
  },
});
```

**Note:** TypeScript automatically infers types from your validation schemas, providing full autocomplete for `input.body`, `input.query`, and `input.params`.

### Validation Sources

Validate `body`, `query`, and `params` independently or together. **Nimble aggregates errors across all sources** (no fail-fast).

```ts
route.put("/users/:id", {
  input: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ notify: z.coerce.boolean().optional() }),
    body: z.object({ name: z.string().min(1) }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      // Errors may come from params, query, and/or body
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    // All three are typed and validated
    const { id, name, notify } = input.params, input.body, input.query;
    const user = updateUser(id, name);
    if (notify) {
      sendNotification(user);
    }

    return { ok: true, response: Response.json(user) };
  },
});
```

**Data extraction rules:**
- **Params**: Raw string values from URL pattern match
- **Query**: String or string[] values from URLSearchParams
  - Single occurrence: `?page=1` → `{ page: "1" }`
  - Repeated keys: `?tag=a&tag=b` → `{ tag: ["a", "b"] }`
- **Body**: Parsed based on Content-Type header
  - `application/json` → JSON
  - `application/x-www-form-urlencoded` → form
  - `multipart/form-data` → form
  - `text/*` → text
  - Unknown/missing → text (fallback)

### Validator Adapters

**Zod:**
```ts
export const zodAdapter: ValidatorAdapter = {
  parse(schema, data) {
    const result = (schema as z.ZodType).safeParse(data);
    if (result.success) return { ok: true, data: result.data };
    return {
      ok: false,
      errors: result.error.errors.map((e) => ({
        path: e.path.map(String),
        message: e.message,
      })),
    };
  },
};
```

**Valibot:**
```ts
export const valibotAdapter: ValidatorAdapter = {
  parse(schema, data) {
    const result = v.safeParse(schema as v.BaseSchema, data);
    if (result.success) return { ok: true, data: result.output };
    return {
      ok: false,
      errors: result.issues.map((issue) => ({
        path: issue.path?.map((p) => String(p.key)) ?? [],
        message: issue.message,
      })),
    };
  },
};
```

**Custom:**
```ts
const customAdapter: ValidatorAdapter = {
  parse(schema, data) {
    const validate = schema as (data: unknown) => { valid: boolean; errors?: string[] };
    const result = validate(data);
    if (result.valid) return { ok: true, data };
    return {
      ok: false,
      errors: (result.errors ?? ["Validation failed"]).map((msg) => ({
        path: [],
        message: msg,
      })),
    };
  },
};
```

### Key Features

- **Explicit validation** — `input.ok` makes validation state clear
- **Guards always run** — Authentication checks happen even with invalid input
- **Error aggregation** — Collects all validation errors (no fail-fast)
- **Pluggable validators** — Works with Zod, Valibot, Arktype, or custom validators
- **Multiple sources** — Validate `body`, `query`, and `params` independently or together
- **Fully typed** — TypeScript inference from your schemas
- **Copy-paste adapters** — You own the adapter code (10-20 lines), no version lock-in
- **Zero dependencies** — No peer deps, no version coupling
- **No automatic responses** — Handlers decide how to handle validation errors

### Important: Body Consumption

When you define `input.body`, the framework parses the request body during validation. **Do not call `request.json()` in your resolver** — the body stream has already been consumed.

```ts
// ✅ Correct
route.post("/users", {
  input: { body: z.object({ name: z.string() }) },
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ }
    const data = input.body; // Use input.body
  },
});

// ❌ Will throw
route.post("/users", {
  input: { body: z.object({ name: z.string() }) },
  resolve: async ({ request }) => {
    const data = await request.json(); // Body already consumed!
  },
});
```

### Validation with Guards

**Guards always run, even if validation fails.** This guarantees that authentication/authorization checks happen before validation errors are exposed.

```ts
route.post("/admin", {
  input: {
    body: z.object({ action: z.string() }),
  },
  guards: [
    ({ cookies }) => {
      // Guard runs even if body is invalid
      if (!cookies["session_id"]) {
        return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
      }
      return { allow: true };
    },
  ],
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    const { action } = input.body;
    return { ok: true, response: Response.json({ action }) };
  },
});
```

**Observable behavior:** If a request has invalid input AND is unauthenticated, the client receives a 401 (from the guard), not a 400 (from validation). This prevents information leakage.

### Output Schemas (OpenAPI)

The `output` config is used for OpenAPI generation only—it is **not validated at runtime**:

```ts
route.get("/users/:id", {
  input: {
    params: z.object({ id: z.string().uuid() }),
  },
  output: {
    body: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    }),
  },
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ }
    const user = findUser(input.params.id);
    // Output schema used for docs, not runtime validated
    return { ok: true, response: Response.json(user) };
  },
});
```

**Why no runtime validation?** Runtime output validation creates an unsolvable problem—what to do when it fails? Return 500 for a working response? Log and return anyway? Trust TypeScript + tests for output correctness.

### Types

```ts
interface ValidationError {
  path: string[];
  message: string;
}

type ValidatedInput<TBody, TQuery, TParams> =
  | { ok: true; body: TBody; query: TQuery; params: TParams }
  | { ok: false; errors: ValidationError[] };

interface InputConfig<TBody, TQuery, TParams> {
  body?: Schema<TBody>;
  query?: Schema<TQuery>;
  params?: Schema<TParams>;
}

interface OutputConfig<TBody> {
  body?: Schema<TBody>;
}

interface ValidatorAdapter {
  parse(schema: unknown, data: unknown):
    | { ok: true; data: unknown }
    | { ok: false; errors: ValidationError[] };
}
```

---

## License

MIT
