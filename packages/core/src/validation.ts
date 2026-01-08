// validation.ts

// Validation error with path and message
export interface ValidationError {
  path: string[];
  message: string;
}

// Discriminated union for validated input
export type ValidatedInput<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> =
  | { ok: true; body: TBody; query: TQuery; params: TParams }
  | { ok: false; errors: ValidationError[] };

// Input schema configuration
export interface InputConfig<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> {
  body?: Schema<TBody>;
  query?: Schema<TQuery>;
  params?: Schema<TParams>;
}

// Output schema configuration (for OpenAPI generation only)
export interface OutputConfig<TBody = unknown> {
  body?: Schema<TBody>;
}

// Generic schema type - any validation library schema
export type Schema<T = unknown> = unknown;

// Utility type to infer the output type from a schema
// Works with Zod, Valibot, and other validation libraries that have an _output or output property
export type InferSchema<T> = T extends { _output: infer O } ? O
  : T extends { _def: { typeName: any }; _output: infer O } ? O
  : T extends { output: infer O } ? O
  : T extends { parse: (data: any) => infer O } ? O
  : unknown;

// Pluggable validator adapter interface
export interface ValidatorAdapter {
  parse(schema: unknown, data: unknown):
    | { ok: true; data: unknown }
    | { ok: false; errors: ValidationError[] };
}

// Parse request body based on content type
// Body is consumed during validation - handlers must use info.input.body, not request.json()/text()
export async function parseBody(
  request: Request,
): Promise<
  { ok: true; data: unknown } | { ok: false; errors: ValidationError[] }
> {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await request.json();
      return { ok: true, data };
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      const data: Record<string, unknown> = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      return { ok: true, data };
    } else if (contentType.includes("text/")) {
      const data = await request.text();
      return { ok: true, data };
    } else {
      // Unknown or missing content-type: parse as text (fallback)
      const data = await request.text();
      return { ok: true, data };
    }
  } catch (error) {
    // Body parse failure - treat as validation error
    let message = "Failed to parse request body";
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes("JSON")) {
        message = "Invalid JSON";
      } else {
        message = error.message;
      }
    }
    return {
      ok: false,
      errors: [{
        path: ["body"],
        message,
      }],
    };
  }
}

// Parse query parameters into an object
// Repeated keys become string arrays: ?tag=a&tag=b&page=2 → { tag: ["a", "b"], page: "2" }
export function parseQuery(url: string): Record<string, unknown> {
  const searchParams = new URL(url).searchParams;
  const query: Record<string, unknown> = {};

  // First pass: collect all values for each key
  const keyValues = new Map<string, string[]>();
  for (const [key, value] of searchParams.entries()) {
    if (!keyValues.has(key)) {
      keyValues.set(key, []);
    }
    keyValues.get(key)!.push(value);
  }

  // Second pass: assign as string or string[]
  for (const [key, values] of keyValues) {
    query[key] = values.length === 1 ? values[0] : values;
  }

  return query;
}

// Validate input using the provided validator adapter
// Validates all defined parts (body, query, params) and aggregates errors across them
// Does not fail fast - collects all validation errors before returning
// Guards always run after validation, regardless of whether input.ok is true or false
export async function validateInput<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
>(
  request: Request,
  params: Record<string, string | undefined>,
  inputConfig: InputConfig<TBody, TQuery, TParams> | undefined,
  validator: ValidatorAdapter | undefined,
): Promise<ValidatedInput<TBody, TQuery, TParams>> {
  // No input config = always ok with undefined values
  if (!inputConfig) {
    return {
      ok: true,
      body: undefined as TBody,
      query: undefined as TQuery,
      params: undefined as TParams,
    };
  }

  const errors: ValidationError[] = [];
  let body: TBody | undefined = undefined;
  let query: TQuery | undefined = undefined;
  let validatedParams: TParams | undefined = undefined;

  // Validate body
  if (inputConfig.body) {
    if (!validator) {
      throw new Error("Validator required when using input.body schema");
    }

    const bodyParseResult = await parseBody(request);
    if (!bodyParseResult.ok) {
      errors.push(...bodyParseResult.errors);
    } else {
      const validationResult = validator.parse(
        inputConfig.body,
        bodyParseResult.data,
      );
      if (validationResult.ok) {
        body = validationResult.data as TBody;
      } else {
        errors.push(...validationResult.errors);
      }
    }
  }

  // Validate query
  if (inputConfig.query) {
    if (!validator) {
      throw new Error("Validator required when using input.query schema");
    }

    const queryData = parseQuery(request.url);
    const validationResult = validator.parse(inputConfig.query, queryData);
    if (validationResult.ok) {
      query = validationResult.data as TQuery;
    } else {
      errors.push(...validationResult.errors);
    }
  }

  // Validate params
  if (inputConfig.params) {
    if (!validator) {
      throw new Error("Validator required when using input.params schema");
    }

    const validationResult = validator.parse(inputConfig.params, params);
    if (validationResult.ok) {
      validatedParams = validationResult.data as TParams;
    } else {
      errors.push(...validationResult.errors);
    }
  }

  // Return result
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    body: body as TBody,
    query: query as TQuery,
    params: validatedParams as TParams,
  };
}
