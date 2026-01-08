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

// Pluggable validator adapter interface
export interface ValidatorAdapter {
  parse(schema: unknown, data: unknown):
    | { ok: true; data: unknown }
    | { ok: false; errors: ValidationError[] };
}

// Parse request body based on content type
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
      // Default to JSON for empty content-type
      const data = await request.json();
      return { ok: true, data };
    }
  } catch (error) {
    return {
      ok: false,
      errors: [{
        path: ["body"],
        message: error instanceof Error
          ? error.message
          : "Failed to parse request body",
      }],
    };
  }
}

// Parse query parameters into an object
export function parseQuery(url: string): Record<string, unknown> {
  const searchParams = new URL(url).searchParams;
  const query: Record<string, unknown> = {};

  for (const [key, value] of searchParams.entries()) {
    // Handle multiple values with same key
    if (key in query) {
      const existing = query[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        query[key] = [existing, value];
      }
    } else {
      query[key] = value;
    }
  }

  return query;
}

// Validate input using the provided validator adapter
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
