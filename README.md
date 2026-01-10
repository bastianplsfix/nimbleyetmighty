# Nimble Request & Validation Model

Nimble follows a **fully explicit control flow**:

> The framework *describes facts*.
> The handler *decides the HTTP response*.

No automatic error responses. No hidden branching.
If something returns a `Response`, **it was written by the user.**

---

# 1. Route Configuration

```ts
route.post("/users/:id", {
  request: {
    params: z.object({ id: z.string().min(1) }),
    query: z.object({ verbose: z.enum(["1"]).optional() }),
    body: z.object({ email: z.string().email() }),
  },

  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: { message: "Bad input", issues: c.input.issues } },
        { status: 400 }
      );
    }

    const { params, query, body } = c.input;
    return Response.json({ params, query, body });
  },
});
```

### Key rule

> **If `request` is defined, validation is always manual.**

The framework never returns 400 for you.
You *must* handle invalid input explicitly.

---

# 2. Validation Behavior

If `request` exists:

1. Nimble validates:

   * `params` (from URLPattern)
   * `query` (from URLSearchParams → object)
   * `body` (parsed JSON, once)

2. Nimble computes a **fact object**:

```ts
c.input
```

### Shape

```ts
type InputOk<P, Q, B> = {
  ok: true;
  params: P;
  query: Q;
  body: B;
};

type InputErr = {
  ok: false;
  failed: Array<"params" | "query" | "body">;
  issues: {
    part: "params" | "query" | "body";
    path: string[];
    message: string;
  }[];
  raw: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
  };
};

type Input<P, Q, B> = InputOk<P, Q, B> | InputErr;
```

### Access rules

* If `ok === false`

  * ❌ No validated values exist
  * ✅ Only `issues`, `failed`, `raw`

* If `ok === true`

  * ✅ `params`, `query`, `body` are safe & typed

This is enforced both **at runtime and by TypeScript.**

---

# 3. Request vs Raw vs Input

| Layer     | What it is                           | Safe |
| --------- | ------------------------------------ | ---- |
| `c.req`   | Native Fetch `Request`               | ❌    |
| `c.raw`   | Framework-extracted convenience data | ❌    |
| `c.input` | Schema-validated data                | ✅    |

### Examples

```ts
c.req.url              // original request
c.raw.query.limit      // "10" (string, unsafe)
c.input.query.limit    // number (safe, validated)
```

Naming is intentional:

* `req` → low-level HTTP
* `raw` → parsed but unsafe
* `input` → trusted

---

# 4. Body Handling (Single-read rule)

> **Request body is read at most once.**

Rules:

* If `request.body` exists:

  * Nimble reads & parses JSON once
  * Cached to:

    * `c.raw.body`
    * `c.input.body` (if valid)
  * ❌ User must NOT call `req.json()` again

* If no `request.body`:

  * Nimble does not touch body
  * User may read it manually

This avoids:

* stream reuse bugs
* double parsing
* unpredictable behavior

---

# 5. Error Handling Philosophy

* **Expected failures**

  * validation
  * auth
  * not found
  * conflict
    → handled explicitly by returning `Response`

* **Unexpected failures**

  * bugs
  * library crashes
    → thrown → caught by global boundary → 500

No exceptions for control flow.

---

# 6. Guarantees

Nimble guarantees:

✔ No hidden responses
✔ No automatic 400s
✔ No implicit branching
✔ One decision boundary (the handler)
✔ Validation never throws
✔ Only `input` is trusted
✔ Request body read once

---

# 7. Mental Model

```
Request
   ↓
Framework extracts facts
   ↓
c.input is computed
   ↓
Handler decides:
  - return Response (error or success)
```

---

# Final Philosophy

> Nimble never decides what HTTP means.
> It only describes what happened.
> The handler commits reality.
