/**
 * Extract trace-id from W3C traceparent header
 * Format: version-traceid-parentid-flags (e.g., 00-abc123...-def456...-01)
 */
function parseTraceParent(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split("-");
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Resolve request ID from headers or generate a new one.
 * Priority: traceparent > x-request-id > x-correlation-id > new UUID
 */
export function resolveRequestId(headers: Headers): string {
  return (
    parseTraceParent(headers.get("traceparent")) ??
      headers.get("x-request-id") ??
      headers.get("x-correlation-id") ??
      crypto.randomUUID()
  );
}
