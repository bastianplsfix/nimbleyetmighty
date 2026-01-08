import type { ValidationResult, Validator } from "../route.ts";

/**
 * Default validation error response
 */
export function defaultValidationErrorResponse(): Response {
  return Response.json(
    {
      error: "Validation failed",
    },
    { status: 400 },
  );
}

/**
 * Run a validator and return ValidationResult
 */
export async function runValidator<TInput, TOutput>(
  validator: Validator<TInput, TOutput>,
  value: TInput,
): Promise<ValidationResult<TOutput>> {
  return await validator.validate(value);
}
