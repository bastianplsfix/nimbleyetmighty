import type { InputResult, RequestSchemas, ValidationIssue } from "../route.ts";

// Parse query string into object with array handling
export function parseQuery(
  url: string,
): Record<string, string | string[]> {
  const parsed = new URL(url);
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of parsed.searchParams) {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }

  return result;
}

// Parse JSON body safely - never throws
export async function parseBody(req: Request): Promise<unknown | undefined> {
  if (!req.body) {
    return undefined;
  }

  try {
    return await req.json();
  } catch {
    // Invalid JSON becomes undefined, will fail validation if schema requires it
    return undefined;
  }
}

// Validate inputs using provided schemas
export function validateInputs(
  schemas: RequestSchemas | undefined,
  raw: {
    params: Record<string, unknown>;
    query: Record<string, unknown>;
    body?: unknown;
  },
): InputResult {
  if (!schemas) {
    // No schemas = no validation = always success with raw values
    return {
      ok: true,
      params: raw.params,
      query: raw.query,
      body: raw.body,
    };
  }

  const failed: ("params" | "query" | "body")[] = [];
  const issues: ValidationIssue[] = [];
  const validated: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
  } = {};

  // Validate params
  if (schemas.params) {
    const result = schemas.params.safeParse(raw.params);
    if (result.success) {
      validated.params = result.data;
    } else {
      failed.push("params");
      for (const issue of result.error.issues) {
        issues.push({
          part: "params",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  } else {
    validated.params = raw.params;
  }

  // Validate query
  if (schemas.query) {
    const result = schemas.query.safeParse(raw.query);
    if (result.success) {
      validated.query = result.data;
    } else {
      failed.push("query");
      for (const issue of result.error.issues) {
        issues.push({
          part: "query",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  } else {
    validated.query = raw.query;
  }

  // Validate body
  if (schemas.body) {
    const result = schemas.body.safeParse(raw.body);
    if (result.success) {
      validated.body = result.data;
    } else {
      failed.push("body");
      for (const issue of result.error.issues) {
        issues.push({
          part: "body",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  } else {
    validated.body = raw.body;
  }

  // If any validation failed, return failure
  if (failed.length > 0) {
    return {
      ok: false,
      failed,
      issues,
      raw,
    };
  }

  // All validations passed
  return {
    ok: true,
    params: validated.params!,
    query: validated.query!,
    body: validated.body!,
  };
}
