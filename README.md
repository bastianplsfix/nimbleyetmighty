# Nimble Web Framework

A minimal, type-safe web framework built on the Web Standards API (`Request`/`Response`/`URLPattern`). Compatible with Deno and Bun runtimes.

---

## Overview

Nimble follows a simple flow:

```
Request → Router (URLPattern matching) → Handler (with context) → Response
```

**Key Features:**
- MSW-style handler context with parsed URL, params, and cookies
- Factory functions for all HTTP methods
- `URLPattern`-based routing with path parameters
- Zero external dependencies

---

## Quick Start

```ts
import { route } from "./route.ts";
import { setupNimble } from "./runtime.ts";

const handlers = [
  route.get("/", () => new Response("Hello, World!")),

  route.get("/users/:id", ({ params }) => {
    return Response.json({ userId: params.id });
  }),

  route.post("/users", async ({ request }) => {
    const body = await request.json();
    return Response.json(body, { status: 201 });
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
| `HandlerContext` | Context object passed to handlers |
| `HandlerFn` | `(ctx: HandlerContext) => Response \| Promise<Response>` |
| `Handler` | Route descriptor: `{ method, path, handler }` |

#### `HandlerContext`

```ts
interface HandlerContext {
  request: Request;           // Original request object
  params: RouteParams;        // Path parameters (e.g., { id: "123" })
  url: URL;                   // Parsed URL object
  cookies: Record<string, string>;  // Parsed cookies
}
```

#### `route` Factory

| Method | Signature |
|--------|-----------|
| `route.get` | `(path: string, handler: HandlerFn) => Handler` |
| `route.head` | `(path: string, handler: HandlerFn) => Handler` |
| `route.post` | `(path: string, handler: HandlerFn) => Handler` |
| `route.put` | `(path: string, handler: HandlerFn) => Handler` |
| `route.patch` | `(path: string, handler: HandlerFn) => Handler` |
| `route.delete` | `(path: string, handler: HandlerFn) => Handler` |
| `route.options` | `(path: string, handler: HandlerFn) => Handler` |
| `route.all` | `(path: string, handler: HandlerFn) => Handler` — Matches any method |
| `route.on` | `(method: string, path: string, handler: HandlerFn) => Handler` — Custom method |

---

### `router.ts`

#### `createRouter(handlers: Handler[])`

Creates a router instance.

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `match` | `(method: string, url: string) => RouteMatch \| null` | Find matching route |
| `handle` | `(req: Request) => Response \| Promise<Response>` | Handle a request |

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
  fetch: (req: Request) => Response | Promise<Response>
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
route.get("/search", ({ url }) => {
  const query = url.searchParams.get("q");
  return Response.json({ query });
});

// Read cookies
route.get("/me", ({ cookies }) => {
  const session = cookies["session_id"];
  return new Response(session ? "Logged in" : "Guest");
});

// Wildcard method matching
route.all("/health", () => new Response("OK"));

// Custom HTTP method
route.on("PURGE", "/cache", () => new Response("Cache cleared"));
```
