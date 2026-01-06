import type { Handler } from "./route.ts";

// Type for composable handler groups
export type HandlerGroup = Handler | Handler[] | HandlerGroup[];

// Compose multiple handlers or handler groups into a flat array
export function group(handlers: HandlerGroup[]): Handler[] {
  const result: Handler[] = [];

  for (const item of handlers) {
    if (Array.isArray(item)) {
      // Recursively flatten nested groups
      result.push(...group(item));
    } else {
      // Single handler
      result.push(item);
    }
  }

  return result;
}
