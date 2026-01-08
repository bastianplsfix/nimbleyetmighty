import type { ValidationResult, Validator } from "../route.ts";

/**
 * Schema that can be adapted to a Validator
 * Supports Zod, Valibot, and other libraries with similar APIs
 */
export type AdaptableSchema<TInput = unknown, TOutput = TInput> =
  | Validator<TInput, TOutput>
  | ZodLikeSchema<TInput, TOutput>
  | ValibotLikeSchema<TInput, TOutput>;

/**
 * Zod-like schema (has safeParse method)
 */
interface ZodLikeSchema<TInput, TOutput> {
  safeParse: (
    value: TInput,
  ) => { success: true; data: TOutput } | { success: false; error: unknown };
}

/**
 * Valibot-like schema (has parse method that throws)
 */
interface ValibotLikeSchema<TInput, TOutput> {
  parse: (value: TInput) => TOutput;
}

/**
 * Check if a value is a Validator
 */
function isValidator<TInput, TOutput>(
  schema: unknown,
): schema is Validator<TInput, TOutput> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "validate" in schema &&
    typeof schema.validate === "function"
  );
}

/**
 * Check if a value is a Zod-like schema
 */
function isZodLike<TInput, TOutput>(
  schema: unknown,
): schema is ZodLikeSchema<TInput, TOutput> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "safeParse" in schema &&
    typeof schema.safeParse === "function"
  );
}

/**
 * Check if a value is a Valibot-like schema
 */
function isValibotLike<TInput, TOutput>(
  schema: unknown,
): schema is ValibotLikeSchema<TInput, TOutput> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "parse" in schema &&
    typeof schema.parse === "function" &&
    !("safeParse" in schema) // Distinguish from Zod
  );
}

/**
 * Normalize any schema to a Validator by duck-typing
 * Supports:
 * - Native Validator interface
 * - Zod (safeParse)
 * - Valibot (parse)
 */
export function normalizeSchema<TInput, TOutput>(
  schema: AdaptableSchema<TInput, TOutput>,
): Validator<TInput, TOutput> {
  // Already a Validator
  if (isValidator<TInput, TOutput>(schema)) {
    return schema as Validator<TInput, TOutput>;
  }

  // Zod-like (safeParse)
  if (isZodLike<TInput, TOutput>(schema)) {
    return {
      validate: (value: TInput): ValidationResult<TOutput> => {
        const result = schema.safeParse(value);
        if (!result.success) {
          return {
            valid: false,
            response: Response.json(
              { error: "Validation failed", details: result.error },
              { status: 400 },
            ),
          };
        }
        return { valid: true, data: result.data };
      },
    };
  }

  // Valibot-like (parse)
  if (isValibotLike<TInput, TOutput>(schema)) {
    return {
      validate: (value: TInput): ValidationResult<TOutput> => {
        try {
          const data = schema.parse(value);
          return { valid: true, data };
        } catch (error) {
          return {
            valid: false,
            response: Response.json(
              { error: "Validation failed", details: error },
              { status: 400 },
            ),
          };
        }
      },
    };
  }

  // Unknown schema type
  throw new Error(
    "Schema must implement Validator.validate(), safeParse() (Zod), or parse() (Valibot)",
  );
}
