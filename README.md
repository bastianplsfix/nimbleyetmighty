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
onRequest (locals only)
   ↓
Route match
   ↓
Extract raw inputs
   ↓
Parse body (if needed)
   ↓
Validate (manual)
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
  handlers: [
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
  handlers,
  onRequest?,
  onResponse?,
  onError?,
  validator?
});
```

### Options

| Name         | Type                           | Description                    |
| ------------ | ------------------------------ | ------------------------------ |
| `handlers`   | `Handler[]`                    | All registered handlers        |
| `onRequest`  | `(req) => void \| LocalsPatch` | Runs **before routing**        |
| `onResponse` | `(c, res) => Response`         | Runs before returning response |
| `onError`    | `(err, c) => Response`         | Global error handler           |
| `validator`  | `NimbleValidator`              | Schema adapter (optional)      |

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
route.get(path, config): Handler
route.head(path, config): Handler
route.post(path, config): Handler
route.put(path, config): Handler
route.patch(path, config): Handler
route.delete(path, config): Handler
route.options(path, config): Handler
route.all(path, config): Handler
route.on(method, path, config): Handler
```

Each route factory returns a **Handler descriptor**:

```ts
{ method, path, handler, guards?, request? }
```

Routes use **URLPattern** for path matching.

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

> When a validator is configured, `params`, `query`, and `body` are automatically **type-inferred** from the schema types.

---

# Validator integration

Nimble is schema-library agnostic.
You plug in validation behavior via `setupNimble`.

```ts
const app = setupNimble<ZodTypeAny>({
  validator: myValidator,
  handlers: [...]
});
```

### Validator contract

```ts
interface NimbleValidator<TSchema> {
  validate<S extends TSchema>(
    schema: S,
    input: unknown,
    part: "params" | "query" | "body"
  ):
    | { ok: true; value: InferSchema<S> }
    | { ok: false; issues: ValidationIssue[]; raw?: unknown }
}
```

### Zod adapter (copy/paste)

```ts
import type { ZodTypeAny } from "zod";

export const zodValidator = {
  validate(schema, input, part) {
    const res = schema.safeParse(input);

    if (res.success) {
      return { ok: true, value: res.data };
    }

    return {
      ok: false,
      raw: res.error,
      issues: res.error.issues.map((i) => ({
        part,
        path: i.path.map(String),
        message: i.message,
      })),
    };
  },
};
```

### Why this design

* Nimble never depends on any schema library
* Inference comes from `safeParse()` typing
* Runtime stays tiny
* Users control error formatting

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
// Step 1
{ requestId }

// Step 2
{ requestId, user }

// Step 3
{ requestId, user, tenant }
```

Later patches override earlier values.

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
  handlers: Handler[]
}): Handler[]
```

Behavior:

```ts
final.guards = [
  ...group.guards,
  ...(route.guards ?? [])
]
```

---

# onRequest hook

Runs **before routing**, receives the raw Fetch `Request`.

Rules:

* Cannot deny
* Cannot return Response
* May only return locals patch

```ts
onRequest: (req) => ({
  requestId: crypto.randomUUID(),
  startedAt: Date.now(),
})
```

Returns a locals patch that will be merged into context **before routing**.

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

---

# Error model

| Type       | Handling        |
| ---------- | --------------- |
| Expected   | Return Response |
| Unexpected | Throw → onError |

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

# Summary

Nimble is:

* explicit
* deterministic
* platform-first
* small

> **Nimble never decides what HTTP means.
> It only describes what happened.
> You commit reality.**
