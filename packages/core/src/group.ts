import type { GuardFn, Handler } from "./route.ts";

// Type for composable handler groups
export type HandlerGroup = Handler | Handler[] | HandlerGroup[];

export interface GroupOptions {
  routes: HandlerGroup[];
  guards?: GuardFn[];
}

// Compose multiple handlers or handler groups into a flat array
// Guards are applied to all handlers in the group and nested groups
export function group(options: GroupOptions): Handler[] {
  const { routes, guards } = options;
  const result: Handler[] = [];

  for (const item of routes) {
    if (Array.isArray(item)) {
      // Recursively flatten nested groups
      const nestedHandlers = group({ routes: item });
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
