# Nimble

> **A minimal, explicit web framework built on Web Standards.**

Nimble is designed around one core idea:

> **The framework describes facts.
> You decide what HTTP means.**

No hidden control flow.
No magic responses.
No implicit error handling.

If a request ends, it’s because **you returned a `Response`**
or a **guard explicitly denied it.**

---

# Philosophy

Nimble is built for:

* Learnability
* Explicit control flow
* Deterministic behavior
* Web platform first (Fetch API)
* Edge compatibility (Deno, Bun, Workers)

### Design laws

1. **One decision boundary**
   Only handlers and guards can end a request.

2. **No hidden branching**
   Nothing auto-returns 400/401/403 for you.

3. **Facts before decisions**
   The framework computes:

   * raw inputs
   * validation results
   * guard facts
     You decide what they mean.

4. **Errors are responses**
   Expected failures are returned explicitly.

5. **Unexpected failures throw**
   Bugs go to one error boundary.

---

# High-level lifecycle

```
Request
   ↓
Route match
   ↓
Extract raw inputs
   ↓
Parse body (if needed)
   ↓
Validate (manual)
   ↓
onRequest (add locals)
   ↓
Guards (allow / deny)
   ↓
Handler (returns Response)
   ↓
onResponse
   ↓
Response
```

---

# Mental model

```
Facts → Gates → Decision
```

* **Facts**

  * `c.raw`
  * `c.input`
  * `c.locals`

* **Gates**

  * guards (allow / deny)

* **Decision**

  * handler returns Response

---

# Installation

```bash
npm install @nimble/core
```

---

# Basic example

```ts
import { setupNimble, route } from "@nimble/core";

const app = setupNimble({
  routes: [
    route.get("/hello", {
      resolve: () => new Response("Hello world"),
    }),
  ],
});

Deno.serve(app);
```

---

# Core API

## `setupNimble()`

```ts
const handler = setupNimble({
  routes,
  onRequest?,
  onResponse?,
  onError?,
});
```

### Options

| Name         | Type                         | Description                    |
| ------------ | ---------------------------- | ------------------------------ |
| `routes`     | `Route[]`                    | All registered routes          |
| `onRequest`  | `(c) => void \| LocalsPatch` | Runs after validation          |
| `onResponse` | `(c, res) => Response`       | Runs before returning response |
| `onError`    | `(err, c) => Response`       | Global error handler           |

Returns:

```ts
(req: Request) => Promise<Response>
```

Compatible with:

* Deno
* Bun
* Cloudflare Workers
* Node (fetch runtimes)

---

# Routing

```ts
route.get(path, config)
route.head(path, config)
route.post(path, config)
route.put(path, config)
route.patch(path, config)
route.delete(path, config)
route.options(path, config)
route.all(path, config)
route.on(method, path, config)
```

Routes use **URLPattern**.

If no route matches → framework returns `404`.

---

# RouteConfig

```ts
interface RouteConfig {
  request?: {
    params?: Schema
    query?: Schema
    body?: Schema
  }

  guards?: GuardFn[]

  resolve: Resolver
}
```

---

# Context (`c`)

```ts
interface Context {
  req: Request
  raw: RawInput
  input: InputState
  locals: Record<string, unknown>
}
```

### Important rules

* Nimble does **not** duplicate HTTP primitives
  Use:

```ts
c.req.headers
c.req.method
new URL(c.req.url)
```

No:

* `c.headers`
* `c.method`
* `c.url`

---

# Raw inputs (`c.raw`)

```ts
interface RawInput {
  params: Record<string, string>
  query: Record<string, string | string[]>
  body?: unknown
}
```

* Extracted by framework
* **Never trusted**
* Only convenience

### Query parsing

```
?tag=a&tag=b&limit=10
→ { tag: ["a","b"], limit: "10" }
```

---

# Body handling

> **Request body is read at most once**

Rules:

* If `request.body` exists:

  * Nimble parses JSON once
  * Cached to `c.raw.body`
  * Do NOT call `req.json()`

* If no `request.body`:

  * Framework does not touch body
  * User may parse manually

Invalid JSON:

* Never throws
* Becomes validation failure

---

# Validation (always manual)

Routes may define schemas:

```ts
request: {
  params?: Schema
  query?: Schema
  body?: Schema
}
```

Schema contract:

```ts
interface Schema<T> {
  safeParse(input: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown }
}
```

Works with:

* Zod
* Valibot
* custom validators

---

## Validation result: `c.input`

```ts
type InputState =
  | {
      ok: true
      params: unknown
      query: unknown
      body: unknown
    }
  | {
      ok: false
      failed: ("params" | "query" | "body")[]
      issues: ValidationIssue[]
      raw: {
        params?: unknown
        query?: unknown
        body?: unknown
      }
    }
```

```ts
interface ValidationIssue {
  part: "params" | "query" | "body"
  path: string[]
  message: string
}
```

### Rule

If:

```ts
c.input.ok === false
```

Then:

* ❌ no validated values exist
* ✅ only `issues`, `failed`, `raw`

---

# Guards

Guards are **pure request gates**.

```ts
type GuardResult =
  | { allow: true; locals?: object }
  | { deny: Response }

type GuardFn = (c: Context) =>
  GuardResult | Promise<GuardResult>
```

### Behavior

* Guards run in order
* First `deny` short-circuits
* Allows may attach locals

### Example

```ts
const requireAuth: GuardFn = async (c) => {
  const token = c.req.headers.get("authorization");
  if (!token) {
    return { deny: new Response("Unauthorized", { status: 401 }) };
  }

  const user = await verify(token);
  return { allow: true, locals: { user } };
};
```

---

# Locals (`c.locals`)

* Request-scoped facts
* **Immutable accumulation**
* Provided by:

  * `onRequest`
  * guards

## How immutable accumulation works

Each guard or hook returns a **locals patch**.
Nimble creates a **new context** with merged locals at each step.

Nothing mutates. Data only flows forward. Every step is pure.

```ts
// Step 1: onRequest adds requestId
context = { ...context, locals: { ...context.locals, { requestId } } }
// → { requestId: "abc" }

// Step 2: Guard adds user
context = { ...context, locals: { ...context.locals, { user } } }
// → { requestId: "abc", user: {...} }

// Step 3: Another guard adds tenant
context = { ...context, locals: { ...context.locals, { tenant } } }
// → { requestId: "abc", user: {...}, tenant: {...} }
```

Later patches override earlier values:

```ts
// onRequest sets role
{ role: "user" }

// Guard overrides role
{ role: "admin" }

// Final locals.role = "admin"
```

Good for:

* user
* tenant
* requestId
* feature flags

Avoid:

* Node buffers
* DB clients
* large payloads

> Locals are **facts**, not services.

---

# group()

Groups compose guards **at build time**.

```ts
group({
  guards: GuardFn[],
  routes: Route[]
})
```

Behavior:

```ts
final.guards = [
  ...group.guards,
  ...(route.guards ?? [])
]
```

No runtime behavior.

### Example

```ts
const apiRoutes = group({
  guards: [requireAuth],
  routes: [
    route.get("/me", { resolve: ... }),
    route.post("/posts", { resolve: ... }),
  ],
});
```

Nested:

```ts
group({
  guards: [requireAuth],
  routes: [
    ...group({
      guards: [requireAdmin],
      routes: [
        route.get("/admin", ...),
      ],
    }),
  ],
});
```

---

# onRequest hook

Runs **after route matching**, receives full `Context`.

Rules:

* Cannot deny
* Cannot return Response
* May only return locals patch

```ts
onRequest: (c) => ({
  requestId: crypto.randomUUID(),
  startedAt: Date.now(),
})
```

Returns a locals patch that creates a **new context** with accumulated locals.

Use for:

* request IDs
* timing
* logging context

---

# onResponse hook

Runs after handler/guard returns Response.

```ts
onResponse(c, res) {
  const headers = new Headers(res.headers);
  headers.set("x-request-id", String(c.locals.requestId));

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
```

---

# onError hook

Catches **unexpected throws**.

```ts
onError(error, c) {
  console.error(error);
  return new Response("Internal Server Error", { status: 500 });
}
```

Expected failures:

* validation
* auth
* domain rules
  → **must be returned explicitly**

---

# Error model

| Type       | Handling        |
| ---------- | --------------- |
| Expected   | Return Response |
| Unexpected | Throw → onError |

No exception-based control flow.

---

# Guard flow diagram

```
Guard #1 → allow + locals
        ↓
Guard #2 → allow
        ↓
Guard #3 → deny → Response returned
```

---

# Validation flow

```
Schemas exist?
     ↓
safeParse each
     ↓
c.input computed
     ↓
Handler decides
```

---

# Full lifecycle diagram

```
Request
   ↓
Route match
   ↓
Extract raw
   ↓
Parse body
   ↓
Validate
   ↓
onRequest
   ↓
Guards
   ↓
Handler
   ↓
onResponse
   ↓
Response
```

---

# What Nimble decides

* 404 if no route matches
* 500 on uncaught throw

# What YOU decide

* 400 validation errors
* 401 / 403 auth
* 409 conflicts
* 200/201 success
* all HTTP semantics

---

# Why Nimble

* Teaches real HTTP
* Makes control flow visible
* Encourages good architecture
* Edge-native
* Minimal surface area

---

# Summary

Nimble is:

* explicit
* deterministic
* platform-first
* small

> **Nimble never decides what HTTP means.
> It only describes what happened.
> You commit reality.**
