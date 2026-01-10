Here’s the **updated framework description** with the new `group()` model baked in.

---

# Nimble Framework – Final Model

Nimble is a minimal web framework built directly on the Fetch API (`Request` / `Response`).

Core rule:

> **The framework describes facts.
> The handler decides the HTTP response.**

Nimble never invents responses.
If a request ends, it’s because **you explicitly returned a `Response`**
or a guard denied it.

---

# Request lifecycle

Single-phase pipeline:

```
Request
→ onRequest (adds locals only)
→ Route match
→ Extract raw inputs
→ Parse body (if needed)
→ Validate (manual)
→ Guards (allow / deny)
→ Handler
→ Return Response
→ Catch unexpected throws → 500
```

---

# 1) Routing

* Uses `URLPattern`
* Matched by method + pattern
* No match → framework returns `404`

---

# 2) Context (`c`)

```ts
c.req     // native Request (source of truth)
c.raw     // extracted, unvalidated values
c.input   // validation gate
c.locals  // accumulated facts (from onRequest + guards)
```

No duplicated primitives:

* ❌ no `c.headers`
* ❌ no `c.method`
* ❌ no `c.url`

Use:

```ts
c.req.headers
c.req.method
new URL(c.req.url)
```

---

# 3) Raw inputs (`c.raw`)

Framework-extracted convenience values (NOT trusted):

```ts
c.raw = {
  params, // URLPattern params (strings)
  query,  // URLSearchParams → object
  body?,  // parsed JSON (only if parsed)
}
```

Query rules:

```
?tag=a&tag=b&limit=10
→ { tag: ["a","b"], limit: "10" }
```

---

# 4) Body handling

> **Body is read at most once**

* If `request.body` exists:

  * Nimble parses JSON once
  * Cached to `c.raw.body`
  * User must NOT call `req.json()`

* If not:

  * Nimble does not touch body
  * User may parse manually

Invalid JSON:

* Never throws
* Becomes validation failure

---

# 5) Built-in validation (always manual)

Routes may define:

```ts
request: {
  params?: Schema
  query?: Schema
  body?: Schema
}
```

Schemas use:

```ts
schema.safeParse(...)
```

Validation:

* never throws
* never returns a response
* only computes facts

Result stored in:

```ts
c.input
```

### Shape

Success:

```ts
{
  ok: true,
  params,
  query,
  body
}
```

Failure:

```ts
{
  ok: false,
  failed: ["params" | "query" | "body"],
  issues: [{ part, path, message }],
  raw: { params?, query?, body? }
}
```

### Access rule

If:

```ts
c.input.ok === false
```

Then:

* ❌ no validated values exist
* ✅ only issues + metadata

---

# 6) onRequest (locals-only hook)

`onRequest` runs **before routing**.

Rules:

* Cannot deny
* Cannot return a Response
* May only return a locals patch

```ts
onRequest: (c) => {
  return { requestId: crypto.randomUUID() }
}
```

Framework merges immutably:

```ts
c.locals = { ...c.locals, ...patch }
```

Use for:

* request IDs
* timing
* logging context

---

# 7) Guards (allow / deny + locals)

Guards are **pure request gates**.

```ts
type GuardResult =
  | { allow: true; locals?: object }
  | { deny: Response }
```

Execution:

* Guards run in order
* First deny short-circuits
* Allows may attach locals

Merge rule:

```ts
c.locals = { ...c.locals, ...patch }
```

Guards remain:

* deterministic
* immutable
* edge-friendly

---

# 8) group()

Groups are **compile-time helpers** for guard composition.

```ts
group({
  guards: GuardFn[],
  handlers: Route[]
})
```

### Behavior

For every route in `handlers`:

```ts
final.guards = [
  ...group.guards,
  ...(route.guards ?? [])
]
```

No prefixing.
No runtime behavior.
Just guard composition.

### Example

```ts
const protectedRoutes = group({
  guards: [requireAuth],
  handlers: [
    route.get("/me", { resolve: ... }),
    route.post("/posts", { resolve: ... }),
  ],
});
```

Use:

```ts
setupNimble({
  routes: [
    route.get("/", ...),
    ...protectedRoutes
  ]
});
```

### Nested groups

```ts
group({
  guards: [requireAuth],
  handlers: [
    ...group({
      guards: [requireAdmin],
      handlers: [
        route.get("/admin", ...),
      ],
    }),
  ],
});
```

Resulting guard order:

```
requireAuth → requireAdmin → route guards
```

---

# 9) Handler (resolver)

```ts
resolve: (c) => Response | Promise<Response>
```

Typical pattern:

```ts
if (!c.input.ok) {
  return Response.json(
    { error: { message: "Bad input", issues: c.input.issues } },
    { status: 400 }
  );
}
```

No magic:

* no thrown control flow
* no auto 400s

---

# 10) Error boundary

Thrown errors mean:

> **Unexpected failure**

Nimble:

* catches all throws
* calls `onError(error, c)`
* otherwise returns `500`

Expected failures:

* validation
* auth
* domain rules
  → **explicit Responses**

---

# 11) Ownership of outcomes

### Framework

* No route → 404
* Uncaught throw → 500

### User

* Validation errors
* Auth failures
* Domain failures
* Success responses
* All HTTP semantics

---

# Mental model

```
Request
   ↓
onRequest adds locals
   ↓
Nimble extracts facts
   ↓
c.raw   (unsafe)
c.input (validated gate)
c.locals (facts)
   ↓
Guards allow / deny
   ↓
Handler commits HTTP reality
```

---

# Philosophy

* No hidden control flow
* No magic responses
* Guards decide denial
* Handlers decide HTTP
* Web standards first

> **Nimble never decides what HTTP means.
> It only describes what happened.
> You commit reality.**


# High-level request lifecycle

```
┌──────────┐
│ Request  │
└────┬─────┘
     │
     ▼
┌───────────────────┐
│ onRequest hook    │  (locals only)
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ Route matching    │
│ (URLPattern)      │
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ Extract raw       │
│ - params          │
│ - query           │
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ Parse body        │
│ (only if schema)  │
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ Validate (manual) │
│ → compute c.input │
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ Guards            │
│ allow / deny      │
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ Handler           │
│ returns Response  │
└────┬──────────────┘
     │
     ▼
┌───────────────────┐
│ onResponse hook   │
└────┬──────────────┘
     │
     ▼
┌──────────┐
│ Response │
└──────────┘
```

---

# Guard flow (with locals)

```
Guards (ordered)

┌──────────────┐
│ Guard #1     │
│ allow + user │
└────┬─────────┘
     │ locals merged
     ▼
┌──────────────┐
│ Guard #2     │
│ allow        │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Guard #3     │
│ deny → 403   │───▶ Response returned immediately
└──────────────┘
```

**Rules**

* Guards run in order
* First `deny` short-circuits
* `locals` accumulate immutably

---

# Validation flow

```
request schema exists?
        │
        ▼
┌────────────────┐
│ Validate parts │
│ params/query   │
│ body (json)    │
└────┬───────────┘
     │
     ▼
┌────────────────────────┐
│ c.input computed       │
│                        │
│ ok === true            │
│   → safe values        │
│                        │
│ ok === false           │
│   → issues only        │
└─────────┬──────────────┘
          │
          ▼
   Handler decides
```

**Important**

* Validation **never returns a response**
* Handler must explicitly handle `!c.input.ok`

---

# Error flow

```
Anything throws?
       │
       ▼
┌───────────────────┐
│ onError hook      │
│ returns Response  │
└────┬──────────────┘
     │
     ▼
┌──────────┐
│ Response │
└──────────┘
```

* Throws = **unexpected failures**
* Validation / auth are **not throws**
* All expected errors = explicit Responses

---

# Group composition (compile-time)

```
group({
  guards: [A, B],
  handlers: [
    route X (guards: [C]),
    route Y
  ]
})

Produces:

Route X guards → [A, B, C]
Route Y guards → [A, B]
```

No runtime behavior.
Just static composition.

---

# Full mental model diagram

```
Request
   │
   ▼
onRequest
(add locals)
   │
   ▼
Route match
   │
   ▼
Extract raw
   │
   ▼
Parse body (if needed)
   │
   ▼
Validate → c.input
   │
   ▼
Guards
(allow / deny + locals)
   │
   ▼
Handler
(return Response)
   │
   ▼
onResponse
   │
   ▼
Response
```

---

# One-line summary diagram

```
Facts → Gates → Decision
```

* Facts = raw + input + locals
* Gates = guards
* Decision = handler
