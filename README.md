## Nimble framework layout

Nimble is a minimal web framework built on the standard `Request` / `Response` model. It’s designed around one rule:

**The framework describes facts. The handler decides the HTTP response.**

There are no implicit error responses. If a request ends early, it’s because a guard denied it or a handler returned a response.

---

## Core pipeline

For each incoming request, Nimble executes this pipeline (single phase):

1. **Route match**
2. **Extract raw inputs**
3. **Validate (manual)**
4. **Run guards (allow / deny)**
5. **Run handler**
6. **Return the final `Response`**
7. **Catch unexpected throws → 500 via `onError`**

---

## 1) Route matching

Nimble matches requests using `URLPattern`.

* Routes are registered as `{ method, pattern, ... }`.
* A request is matched by method + `URLPattern` execution.
* If no route matches: return `404` (framework-owned, because no handler exists to decide).

On match, Nimble produces:

* the matched route definition
* URLPattern match result (including string params)

---

## 2) Context creation

Nimble creates a per-request context object `c`. This context is immutable by default (you can still store `locals` if you want, but nothing in the core model requires mutation).

At minimum it includes:

* `c.req` — the original Fetch `Request`
* `c.url` — a `URL` instance for `req.url`
* `c.method` — request method
* `c.headers` — request headers
* `c.raw` — framework-extracted but *unvalidated* values

### Raw inputs (`c.raw`)

Raw values are convenience extractions from the request. They are not trusted.

* `c.raw.params` — `{ [name: string]: string }` from URLPattern
* `c.raw.query` — object built from `URLSearchParams`:

  * single key → string
  * repeated key → string[]
* `c.raw.body` — only present if the framework parsed the body

---

## 3) Body parsing rules (single-read)

The request body is a stream and is read at most once.

* If the matched route defines `request.body`, Nimble reads the body once and parses JSON.

  * On invalid JSON, Nimble does **not** throw. It records a validation failure instead.
* If the route has no `request.body`, Nimble does not touch the body.

  * The handler may read it manually.

If Nimble parses the body, the parsed value is cached to `c.raw.body`.

---

## 4) Built-in validation (always manual)

Routes may define request schemas:

```ts
request: {
  params?: Schema
  query?: Schema
  body?: Schema
}
```

Schemas are duck-typed via `safeParse(...)` (Zod-first, not Zod-locked).

Nimble validates each provided part against its schema and produces:

* `c.input` — a discriminated union describing the validation result

### `c.input` shape

* If validation succeeds for all provided schemas:

```ts
c.input = {
  ok: true,
  params, query, body // typed validated values
}
```

* If any provided schema fails:

```ts
c.input = {
  ok: false,
  failed: ["params" | "query" | "body", ...],
  issues: [{ part, path, message }, ...],
  raw: { params?, query?, body? } // raw schema errors / debugging info
}
```

### Validation access rule

When `c.input.ok === false`:

* Nimble exposes **no validated values**
* the handler must branch and decide the response

This prevents accidental use of unvalidated data and keeps the “validated gate” explicit.

---

## 5) Guards (allow / deny)

Routes can define ordered guards:

```ts
guards: GuardFn[]
```

A guard is a pure request gate:

* It receives the same context `c` (including `c.raw` and `c.input`)
* It returns either:

```ts
{ allow: true }
```

or

```ts
{ deny: Response }
```

### Guard behavior

* Guards run in order after validation.
* If any guard returns `{ deny: Response }`, the pipeline stops immediately and that `Response` is returned.
* If all guards allow, the handler runs.

Guards may deny regardless of validation state. (For example: auth can deny even when input is invalid.)

---

## 6) Handler (resolver)

Every route has a resolver:

```ts
resolve: (c) => Response | Promise<Response>
```

The resolver always returns a `Response`. This is Option A: errors are handled explicitly as responses.

Common pattern:

```ts
if (!c.input.ok) return Response.json(..., { status: 400 });
```

If the resolver returns, that response is final.

---

## 7) Error boundary (`onError`)

Nimble treats thrown exceptions as **unexpected failures**.

* Anything thrown during parsing, validation, guards, or handler execution is caught by a single boundary.
* The boundary calls `onError(error, c)` if provided.
* If no custom handler exists, Nimble returns a generic `500 Internal Server Error`.

This keeps “expected failures” (validation/auth/not-found) explicit and “unexpected failures” centralized.

---

## 8) What the framework decides vs what users decide

### Framework-owned outcomes

* **404 no route matched** (no handler exists)
* **500 unexpected throw** (unless customized by `onError`)

### User-owned outcomes

* Validation failures (always manual)
* Auth failures (guards deny)
* Business rule failures
* Conflicts, not founds, etc. inside the domain
* All normal success responses

---

## The mental model

Nimble has exactly one “commit point”:

* Guards commit by returning a deny `Response`
* Handlers commit by returning a `Response`

Everything else is just producing facts:

* `c.raw` = extracted but unsafe
* `c.input` = validated gate (safe only when ok)

That’s the whole framework layout: explicit, deterministic, and easy to reason about.
