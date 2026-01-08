# Request Validation

Nimble supports declarative request validation using a pluggable validator adapter. Validation runs before guards and the handler, but it never produces a Response. Only guards or the handler can return a response.

This guarantees:
- **Guards can deny unauthenticated requests even when input is invalid.**
- **Validation errors are only returned if the handler chooses to return them.**

## Execution Flow

```
Request
  → onRequest
  → Router (URLPattern match + params)
  → Validation (populate info.input)
  → Guards (deny short-circuit)
  → Handler (decides how to handle info.input)
  → onResponse
  → Response
```

**Important rule: Guards always run, even if validation fails.**

## Route Configuration

### InputConfig

```typescript
interface InputConfig<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body?: Schema<TBody>;
  query?: Schema<TQuery>;
  params?: Schema<TParams>;
}
```

### RouteConfig

```typescript
interface RouteConfig<TBody = unknown, TQuery = unknown, TParams = unknown, TOutput = unknown> {
  input?: InputConfig<TBody, TQuery, TParams>;
  output?: unknown; // OpenAPI only; ignored at runtime
  guards?: GuardFn[];
  resolve: (info: ResolverInfo<TBody, TQuery, TParams>) => ResolveResult | Promise<ResolveResult>;
}
```

## Types

### ValidationError

```typescript
interface ValidationError {
  path: string[];
  message: string;
}
```

### ValidatedInput

Binary discriminated union.

```typescript
type ValidatedInput<TBody, TQuery, TParams> =
  | { ok: true; body: TBody; query: TQuery; params: TParams }
  | { ok: false; errors: ValidationError[] };
```

### ResolverInfo

```typescript
interface ResolverInfo<TBody = unknown, TQuery = unknown, TParams = unknown> {
  request: Request;
  requestId: string;
  params: RouteParams;                 // raw string params from router
  cookies: Record<string, string>;     // parsed Cookie header
  input: ValidatedInput<TBody, TQuery, TParams>;
}
```

## Validator Adapter

Nimble does not depend on a validation library.

```typescript
interface ValidatorAdapter {
  parse(schema: unknown, data: unknown):
    | { ok: true; data: unknown }
    | { ok: false; errors: ValidationError[] };
}
```

### Validator requirement

**If any route defines `config.input`, then `setupNimble({ validator })` must provide a validator adapter.**

If not provided, Nimble throws at startup (not at request time).

## Validation Semantics

### When validation runs

Validation runs for every matched route:
- If the route defines `input`, validation attempts all defined parts (body, query, params).
- If the route does not define `input`, Nimble still sets `info.input` to a default "ok" value (see below).

### Default input when no schemas exist

If a route has no input config:

```typescript
info.input = { ok: true, body: undefined, query: undefined, params: undefined };
```

## Data Extraction Rules

### Params (source)

- `rawParams` come from the router match result.
- `rawParams` values are strings (or undefined).
- If `input.params` schema exists, validate against `rawParams`.

### Query (source)

Query is derived from `new URL(request.url).searchParams`.

Convert to an object with string or string[] values:
- If a key occurs once: `value: string`
- If a key occurs multiple times: `value: string[]`

**Example:** `?tag=a&tag=b&page=2`

```typescript
{ tag: ["a", "b"], page: "2" }
```

If `input.query` schema exists, validate against this query object.

### Body (source)

Body parsing happens **only if `input.body` schema exists**.

Determine parsing strategy from Content-Type:
- `application/json` → parse JSON
- `text/*` → parse text
- `application/x-www-form-urlencoded` → parse form
- `multipart/form-data` → parse form

**If Content-Type is missing or unrecognized:**
- Parse as text (simple fallback)

#### Body consumption

When `input.body` is defined, the framework consumes the request body during validation.

After that, handlers must use `info.input.body`, not `request.json()` / `request.text()`.

#### Body Parse Failure

If body parsing throws (invalid JSON, etc.):
- Validation fails (`ok:false`)
- Add an error:

```typescript
{ path: ["body"], message: "Invalid JSON" } // or appropriate message
```

This is treated the same as schema validation errors.

## Schema Validation Rules

For each schema that exists (params, query, body):
1. Run `validator.parse(schema, data)`
2. Collect:
   - `data` when ok
   - `errors` when not ok

### Aggregation behavior

**Nimble validates all defined parts and aggregates errors across them.**

Nimble does not "fail fast".

### Result construction

If any part fails:

```typescript
info.input = { ok: false, errors: allErrors }
```

If all parts pass:

```typescript
info.input = { ok: true, body: parsedBody, query: parsedQuery, params: parsedParams }
```

For parts without schemas: Use `undefined` in the `ok:true` case.

## Guard Execution Rules

**Guards always run after validation, regardless of `input.ok`.**

### Guard contract

```typescript
{ allow: true } → continue
{ deny: Response } → stop immediately and return deny response
```

First deny wins (no aggregation).

### No implicit coupling

Guards must not rely on validation always succeeding. If a guard needs typed input, it must check `info.input.ok` itself.

## Handler Rule

Handlers receive `info.input` and decide what to do:

If `input.ok === false`, handler may:
- return a 400/422 response with errors
- return a generic error
- ignore errors (not recommended but allowed)

**Nimble does not enforce any default response for validation failure.**

## Observable Behavior Guarantees

### Unauthenticated + invalid input

1. Validation runs and populates `info.input.ok=false`
2. Auth guard can deny
3. Handler does not run
4. Client receives auth response (e.g. 401), not validation errors

### Authenticated + invalid input

1. Guards allow
2. Handler runs
3. Handler chooses whether to return validation errors

### No schema

- `info.input.ok === true` always
- No parsing/validation occurs

## Example: Zod Adapter

```typescript
import { z } from "zod";
import type { ValidatorAdapter } from "@bastianplsfix/nimble";

const zodAdapter: ValidatorAdapter = {
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

## Example: Basic Usage

```typescript
import { route, setupNimble } from "@bastianplsfix/nimble";
import { z } from "zod";

const handlers = [
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

      const user = input.body; // { name: string, email: string }
      return {
        ok: true,
        response: Response.json({ id: crypto.randomUUID(), ...user }, {
          status: 201,
        }),
      };
    },
  }),
];

const app = setupNimble({ 
  handlers, 
  validator: zodAdapter 
});
```

## Example: Guards with Validation

```typescript
route.post("/admin", {
  input: {
    body: z.object({ action: z.string() }),
  },
  guards: [
    ({ cookies, input }) => {
      // Guard runs even if validation failed
      if (!cookies["session_id"]) {
        return {
          deny: Response.json({ error: "Unauthorized" }, { status: 401 }),
        };
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
    return {
      ok: true,
      response: Response.json({ action }),
    };
  },
})
```

## Example: Multiple Input Sources

```typescript
route.put("/users/:id", {
  input: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ notify: z.enum(["true", "false"]) }),
    body: z.object({ name: z.string() }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    const { id } = input.params;
    const { notify } = input.query;
    const { name } = input.body;

    return {
      ok: true,
      response: Response.json({ id, name, notify }),
    };
  },
})
```

## Example: Repeated Query Parameters

```typescript
route.get("/search", {
  input: {
    query: z.object({
      tag: z.array(z.string()),  // ?tag=a&tag=b&tag=c
      page: z.coerce.number(),   // ?page=2
    }),
  },
  resolve: ({ input }) => {
    if (!input.ok) {
      return {
        ok: false,
        response: Response.json({ errors: input.errors }, { status: 400 }),
      };
    }

    const { tag, page } = input.query;
    // tag is string[] if multiple values
    // page is string if single value

    return {
      ok: true,
      response: Response.json({ tag, page }),
    };
  },
})
```

## Non-goals

- No validation hooks (onValidationError, etc.)
- No helper functions
- No automatic error responses
- No built-in error formatting beyond the ValidationError shape
- No runtime output validation
