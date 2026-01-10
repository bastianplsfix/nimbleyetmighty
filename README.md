# Nimble Framework – Final Model

Nimble is a minimal web framework built directly on the Fetch API (`Request` / `Response`).

Its core rule:

> **The framework describes facts.
> The handler decides the HTTP response.**

Nimble never returns “helpful” responses for you.
If a request ends, it’s because **you explicitly returned a `Response`**
(or a guard denied it).

---

# Request lifecycle

For every incoming request, Nimble runs this **single-phase pipeline**:

```
Request
→ Route match
→ Extract raw inputs
→ Parse body (if needed)
→ Validate (manual)
→ Run guards
→ Run handler
→ Return Response
→ Catch unexpected throws → 500
```

---

# 1) Routing

* Routes are matched using `URLPattern`
* Match is done by:

  * HTTP method
  * URL pattern

If no route matches:

* Nimble returns `404`
* (This is framework-owned because no handler exists)

---

# 2) Context (`c`)

Each request gets a **context object**:

```ts
c.req // native Fetch Request (source of truth)
c.raw // extracted but unvalidated values
c.input // validation result (safe only if ok)
```

Nimble does **not** duplicate HTTP primitives:

* No `c.headers`
* No `c.method`
* No `c.url`

Use:

```ts
c.req.headers
c.req.method
new URL(c.req.url)
```

---

# 3) Raw inputs (`c.raw`)

`raw` is **framework-extracted convenience data**.
It is **not trusted**.

```ts
c.raw = {
  params, // from URLPattern (strings)
  query,  // from URLSearchParams → object
  body?,  // parsed JSON (only if framework parsed)
}
```

### Query parsing rules

`?tag=a&tag=b&limit=10` becomes:

```ts
{
  tag: ["a", "b"],
  limit: "10"
}
```

No coercion is done automatically.

---

# 4) Body handling (single-read rule)

> **The request body is read at most once.**

Rules:

* If route defines `request.body`

  * Nimble parses JSON once
  * Cached to `c.raw.body`
  * User must NOT call `req.json()`

* If no `request.body`

  * Nimble does not touch the body
  * User may read manually

Invalid JSON:

* Does NOT throw
* Becomes a validation failure

---

# 5) Built-in validation (always manual)

Routes may define schemas:

```ts
request: {
  params?: Schema
  query?: Schema
  body?: Schema
}
```

Schemas are duck-typed via:

```ts
schema.safeParse(input)
```

Validation **never returns a response**
Validation **never throws**

Instead Nimble computes:

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
  issues: [
    { part, path, message }
  ],
  raw: {
    params?,
    query?,
    body?
  }
}
```

### Access rule

When:

```ts
c.input.ok === false
```

Then:

* ❌ No validated values exist
* ✅ Only `issues`, `failed`, `raw`

This is enforced by typing and runtime.

---

# 6) Guards (allow / deny)

Guards are **pure request gates**:

```ts
type GuardResult =
  | { allow: true }
  | { deny: Response }
```

```ts
type GuardFn = (c) => GuardResult | Promise<GuardResult>
```

Execution:

* Guards run **after validation**
* Ordered
* First deny short-circuits

Rules:

* Guards may deny regardless of validation state
* Guards return concrete HTTP responses
* Guards never mutate request state

Example:

```ts
const requireAuth = (c) => {
  if (!c.req.headers.get("authorization")) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { allow: true }
}
```

---

# 7) Handler (resolver)

Handlers **always return a Response**:

```ts
resolve: (c) => Response | Promise<Response>
```

Typical pattern:

```ts
if (!c.input.ok) {
  return Response.json(
    { error: { message: "Bad input", issues: c.input.issues } },
    { status: 400 }
  )
}

// Safe here
const { params, body } = c.input
```

There are:

* no helper throws
* no implicit 400s
* no magic

---

# 8) Error boundary

Thrown errors mean:

> **Something unexpected happened**

* Bugs
* Crashes
* Library failures

Nimble:

* catches all throws
* calls `onError(error, c)` if provided
* otherwise returns `500`

Expected failures:

* validation
* auth
* business rules
  → are **explicit Responses**

---

# 9) Ownership of outcomes

### Framework decides

* No route matched → 404
* Unhandled exception → 500

### User decides

* Validation errors
* Auth failures
* Business logic
* Success responses
* All HTTP semantics

---

# 10) Final mental model

```
Request
   ↓
Nimble extracts facts
   ↓
c.raw (unsafe)
c.input (validated gate)
   ↓
Guards decide allow / deny
   ↓
Handler commits HTTP reality
```

---

# Philosophy

* No hidden control flow
* No magic responses
* No helper traps
* One decision boundary
* Web standards first

> **Nimble never decides what HTTP means.
> It only describes what happened.
> You commit reality.**

---

This model is:

* teachable
* deterministic
* debuggable
* philosophically consistent

It’s honestly very strong 👌
