import type { GuardFn, Handler } from "./route.ts";

// Type for composable handler groups
export type HandlerGroup = Handler | Handler[] | HandlerGroup[];

export interface GroupOptions {
  handlers: HandlerGroup[];
  guards?: GuardFn[];
}

// Compose multiple handlers or handler groups into a flat array
// Guards are applied to all handlers in the group and nested groups
export function group(options: GroupOptions): Handler[];
export function group(handlers: HandlerGroup[]): Handler[];
export function group(
  handlersOrOptions: HandlerGroup[] | GroupOptions,
): Handler[] {
  let handlers: HandlerGroup[];
  let guards: GuardFn[] | undefined;

  // Handle both function signatures
  if (Array.isArray(handlersOrOptions)) {
    handlers = handlersOrOptions;
    guards = undefined;
  } else {
    handlers = handlersOrOptions.handlers;
    guards = handlersOrOptions.guards;
  }

  const result: Handler[] = [];

  for (const item of handlers) {
    if (Array.isArray(item)) {
      // Recursively flatten nested groups
      const nestedHandlers = group(item);
      result.push(...nestedHandlers);
    } else {
      // Single handler
      result.push(item);
    }
  }

  // Apply guards to all handlers in this group
  if (guards && guards.length > 0) {
    return result.map((handler) => ({
      ...handler,
      guards: [...(guards || []), ...(handler.guards || [])],
    }));
  }

  return result;
}
