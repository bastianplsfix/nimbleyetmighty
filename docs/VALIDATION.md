# Request Validation

This guide covers request validation in Nimble, following the explicit `ok` pattern used throughout the framework.

## Overview

Nimble provides request validation through pluggable validator adapters. The validation result is explicitly handled in your route handler, giving you full control over error responses.

**Key features:**

- **Consistent pattern** — `{ ok: true, ... } | { ok: false, ... }` everywhere
- **Explicit control flow** — Validation result handled in handler, not hidden
- **Pluggable validators** — Use Zod, Valibot, Arktype, or custom validators
- **Input/Output symmetry** — `input` for request validation, `output` for OpenAPI generation

## Quick Start

### 1. Create a Validator Adapter

Copy the adapter for your validation library:

#### Zod

```ts
// lib/validation.ts
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

#### Valibot

```ts
// lib/validation.ts
import type { ValidatorAdapter } from "@bastianplsfix/nimble";
import * as v from "valibot";

export const valibotAdapter: ValidatorAdapter = {
  parse(schema, data) {
    const result = v.safeParse(schema as v.BaseSchema, data);
    if (result.success) {
      return { ok: true, data: result.output };
    }
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

#### Custom Adapter

```ts
const customAdapter: ValidatorAdapter = {
  parse(schema, data) {
    // schema could be a function, class, or any custom format
    const validate = schema as (data: unknown) => { valid: boolean; errors?: string[] };
    const result = validate(data);

    if (result.valid) {
      return { ok: true, data };
    }

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

### 2. Configure Nimble

```ts
import { setupNimble } from "@bastianplsfix/nimble";
import { zodAdapter } from "./lib/validation.ts";

const app = setupNimble({
  handlers,
  validator: zodAdapter,
});
```

### 3. Use Validation in Routes

```ts
import { route } from "@bastianplsfix/nimble";
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

    // input.body is now typed and validated
    const user = createUser(input.body);
    return { ok: true, response: Response.json(user, { status: 201 }) };
  },
});
```

## Types

### ValidationError

```ts
interface ValidationError {
  path: string[];
  message: string;
}
```

### ValidatedInput

Discriminated union passed to handlers when `input` schema is defined:

```ts
type ValidatedInput<TBody, TQuery, TParams> =
  | { ok: true; body: TBody; query: TQuery; params: TParams }
  | { ok: false; errors: ValidationError[] };
```

### InputConfig

Schema configuration on route:

```ts
interface InputConfig<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body?: Schema<TBody>;
  query?: Schema<TQuery>;
  params?: Schema<TParams>;
}
```

### OutputConfig

Schema configuration for OpenAPI generation (no runtime validation):

```ts
interface OutputConfig<TBody = unknown> {
  body?: Schema<TBody>;
}
```

### ValidatorAdapter

Pluggable validation interface:

```ts
interface ValidatorAdapter {
  parse(schema: unknown, data: unknown):
    | { ok: true; data: unknown }
    | { ok: false; errors: ValidationError[] };
}
```

## Usage Examples

### Basic Body Validation

```ts
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

    const user = createUser(input.body);
    return { ok: true, response: Response.json(user, { status: 201 }) };
  },
});
```

### Query Parameters

```ts
route.get("/search", {
  input: {
    query: z.object({
      q: z.string().min(1),
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().positive().max(100).default(20),
    }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    const results = search(input.query.q, {
      page: input.query.page,
      limit: input.query.limit,
    });

    return { ok: true, response: Response.json(results) };
  },
});
```

### Path Parameters

```ts
route.get("/users/:id", {
  input: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    const user = findUser(input.params.id);

    if (!user) {
      return {
        ok: false,
        response: Response.json({ error: "User not found" }, { status: 404 }),
      };
    }

    return { ok: true, response: Response.json(user) };
  },
});
```

### Multiple Input Sources

```ts
route.put("/users/:id", {
  input: {
    params: z.object({
      id: z.string().uuid(),
    }),
    query: z.object({
      notify: z.coerce.boolean().optional(),
    }),
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

    const user = updateUser(input.params.id, input.body);

    if (input.query.notify) {
      sendNotification(user);
    }

    return { ok: true, response: Response.json(user) };
  },
});
```

### Context-Aware Error Responses

```ts
route.post("/api/data", {
  input: {
    body: z.object({ value: z.number() }),
  },
  resolve: ({ input, cookies }) => {
    if (!input.ok) {
      const isAdmin = cookies.role === "admin";

      return {
        ok: false,
        response: Response.json(
          isAdmin
            ? { errors: input.errors, debug: true }
            : { error: "Invalid request" },
          { status: 400 }
        ),
      };
    }

    return { ok: true, response: Response.json({ received: input.body.value }) };
  },
});
```

### With Output Schema (OpenAPI)

The `output` schema is used for OpenAPI generation only—it is **not validated at runtime**.

```ts
route.get("/users/:id", {
  input: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  output: {
    body: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      createdAt: z.string().datetime(),
    }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    const user = findUser(input.params.id);

    if (!user) {
      return {
        ok: false,
        response: Response.json({ error: "User not found" }, { status: 404 }),
      };
    }

    // Output schema used for OpenAPI generation, not runtime validated
    return { ok: true, response: Response.json(user) };
  },
});
```

## Edge Cases

### No Input Schema

When a route has no `input` config, the framework always returns `ok: true` with `undefined` values:

```ts
route.get("/health", {
  resolve: ({ input }) => {
    // input is: { ok: true, body: undefined, query: undefined, params: undefined }
    return { ok: true, response: Response.json({ status: "healthy" }) };
  },
});
```

No validation runs, and you don't need to check `input.ok`.

### Partial Input Schema

Only defined schemas are validated:

```ts
route.post("/users/:id", {
  input: {
    body: z.object({ name: z.string() }),
    // query not defined
    // params not defined
  },
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ }
    
    // input.body: { name: string }
    // input.query: undefined
    // input.params: undefined
  },
});
```

### Body Parsing Failure

If the body cannot be parsed (invalid JSON, etc.), validation fails:

```ts
{
  ok: false,
  errors: [{ path: ["body"], message: "Unexpected token..." }]
}
```

## Request Body Consumption

### ⚠️ Important: Body Already Consumed

When you define `input.body`, the framework parses the request body during validation. **Calling `request.json()` in your resolver will fail** because the body stream has already been consumed.

**✅ Correct:**

```ts
route.post("/users", {
  input: {
    body: z.object({ name: z.string() }),
  },
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ }
    const data = input.body; // ✅ Use input.body
  },
});
```

**❌ Will Throw:**

```ts
route.post("/users", {
  input: {
    body: z.object({ name: z.string() }),
  },
  resolve: async ({ request, input }) => {
    const data = await request.json(); // ❌ Body already consumed
  },
});
```

### When to Use `request.json()`

Only use `request.json()` when you **don't** define `input.body`:

```ts
route.post("/webhook", {
  // No input.body schema
  resolve: async ({ request }) => {
    const payload = await request.json(); // ✅ Body not consumed
    // Handle unknown webhook structure
  },
});
```

## Validation with Guards

Guards receive the validated input and can make authorization decisions based on it:

```ts
route.post("/admin", {
  input: {
    body: z.object({ action: z.string() }),
  },
  guards: [
    ({ input }) => {
      if (!input.ok) {
        return { deny: Response.json({ error: "Invalid input" }, { status: 400 }) };
      }

      if (input.body.action === "delete") {
        return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
      }

      return { allow: true };
    },
  ],
  resolve: ({ input }) => {
    // Guards passed, input is valid
    return { ok: true, response: Response.json({ ok: true }) };
  },
});
```

## Startup Validation

If a route uses `input` schemas without configuring a validator, Nimble throws an error at startup:

```ts
Error: Route "POST /users" has input schema but no validator configured.
Pass a validator to setupNimble({ validator: yourAdapter }).
```

This prevents runtime errors and ensures correct configuration.

## Body Parsing

Nimble automatically parses request bodies based on `Content-Type`:

| Content-Type | Parsing Method |
|--------------|---------------|
| `application/json` | `request.json()` |
| `application/x-www-form-urlencoded` | `request.formData()` → object |
| `multipart/form-data` | `request.formData()` → object |
| `text/*` | `request.text()` |
| Empty or unknown | Defaults to `request.json()` |

## Query Parsing

Query parameters are parsed from the URL search params:

```
GET /search?q=test&page=2

input.query = { q: "test", page: "2" }
```

Multiple values with the same key are converted to arrays:

```
GET /tags?tag=foo&tag=bar

input.query = { tag: ["foo", "bar"] }
```

Use `z.coerce` for type conversion:

```ts
z.object({
  page: z.coerce.number(),
  active: z.coerce.boolean(),
})
```

## Why Copy-Paste Adapters?

Instead of publishing separate adapter packages, Nimble encourages copying adapters directly into your project:

### Benefits

| **Benefit** | **Why It Matters** |
|-------------|-------------------|
| True zero dependencies | No peer deps, no version ranges, no "zod not found" errors |
| No version coupling | Zod 4 breaks things? Not your problem. Users update their adapter. |
| You own the code | Modify freely without forking framework |
| Framework stays thin | Adapter is 15 lines—not worth a dependency |
| Encourages understanding | You read it, know exactly how validation plugs in |
| No maintenance burden | Nimble doesn't track Zod/Valibot/Arktype releases |

Adapters are intentionally simple (10-20 lines). You own them, customize them, and they never break.

## Output Schema

### Purpose

The `output` config exists **solely for OpenAPI/documentation generation**. It is **not validated at runtime**.

### Rationale

Runtime output validation creates an unsolvable problem: what to do when validation fails?

| Option | Problem |
|--------|---------|
| Return 500 | User gets error for working response |
| Log and return anyway | Why validate? |
| Strip invalid fields | Silent data loss |

Trust TypeScript + tests for output correctness. Use `output` schema for:

- OpenAPI spec generation
- Client SDK generation
- API documentation

### Future Consideration

If needed, a dev-only mode could be added:

```ts
const app = setupNimble({
  handlers,
  validator: zodAdapter,
  dev: {
    validateOutput: true, // Throws in dev if output doesn't match schema
  },
});
```

Not in initial implementation.

## Execution Flow

```
Request
  ↓
onRequest Hook
  ↓
Router Match
  ↓
Validation (body, query, params)
  ↓
Guards (receive validated input)
  ↓
Handler (receive validated input)
  ↓
onResponse Hook
  ↓
Response
```

## Best Practices

### 1. Always Check `input.ok`

```ts
resolve: ({ input }) => {
  if (!input.ok) {
    return {
      ok: false,
      response: Response.json({ errors: input.errors }, { status: 400 }),
    };
  }

  // Now TypeScript knows input.body, input.query, input.params are available
}
```

### 2. Create Reusable Error Handlers

```ts
function validationError(errors: ValidationError[]) {
  return {
    ok: false as const,
    response: Response.json({ errors }, { status: 400 }),
  };
}

resolve: ({ input }) => {
  if (!input.ok) return validationError(input.errors);
  // ...
}
```

### 3. Use Type Inference

```ts
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

type User = z.infer<typeof userSchema>;

route.post("/users", {
  input: { body: userSchema },
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ }
    
    // input.body is typed as User
    const user: User = input.body;
  },
});
```

### 4. Validate Early, Fail Fast

Put validation schemas at the route level, not inside the handler. This makes it clear what data the route expects and ensures validation happens before guards and business logic.

### 5. Use Guards for Authorization

Validation checks **what** the data is. Guards check **who** can access it:

```ts
route.post("/admin", {
  input: {
    body: z.object({ action: z.string() }),
  },
  guards: [requireAdmin], // Check WHO
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ } // Check WHAT
    // Perform action
  },
});
```

## TypeScript Support

The validation system is fully typed:

```ts
route.post<
  { name: string; email: string }, // TBody
  { page: number },                // TQuery
  { id: string }                   // TParams
>("/users/:id", {
  input: {
    params: z.object({ id: z.string() }),
    query: z.object({ page: z.coerce.number() }),
    body: z.object({ name: z.string(), email: z.string() }),
  },
  resolve: ({ input }) => {
    if (!input.ok) { /* ... */ }
    
    // Fully typed:
    input.params.id;      // string
    input.query.page;     // number
    input.body.name;      // string
    input.body.email;     // string
  },
});
```

Type inference works automatically when using validators that support it (like Zod's `z.infer`).
