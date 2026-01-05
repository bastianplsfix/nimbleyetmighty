import { assertEquals, assertMatch } from "@std/assert";
import { resolveRequestId } from "../../src/internal/request_id.ts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.test("resolveRequestId generates UUID when no headers present", () => {
  const headers = new Headers();
  const requestId = resolveRequestId(headers);
  assertMatch(requestId, UUID_REGEX);
});

Deno.test("resolveRequestId extracts trace-id from traceparent", () => {
  const headers = new Headers({
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  });
  assertEquals(
    resolveRequestId(headers),
    "0af7651916cd43dd8448eb211c80319c",
  );
});

Deno.test("resolveRequestId uses x-request-id header", () => {
  const headers = new Headers({
    "x-request-id": "req-12345",
  });
  assertEquals(resolveRequestId(headers), "req-12345");
});

Deno.test("resolveRequestId uses x-correlation-id header", () => {
  const headers = new Headers({
    "x-correlation-id": "corr-67890",
  });
  assertEquals(resolveRequestId(headers), "corr-67890");
});

Deno.test("resolveRequestId prefers traceparent over x-request-id", () => {
  const headers = new Headers({
    traceparent: "00-traceid123456789012345678901234-parentid12345678-01",
    "x-request-id": "req-12345",
  });
  assertEquals(
    resolveRequestId(headers),
    "traceid123456789012345678901234",
  );
});

Deno.test("resolveRequestId prefers x-request-id over x-correlation-id", () => {
  const headers = new Headers({
    "x-request-id": "req-12345",
    "x-correlation-id": "corr-67890",
  });
  assertEquals(resolveRequestId(headers), "req-12345");
});

Deno.test("resolveRequestId falls back when traceparent is malformed", () => {
  const headers = new Headers({
    traceparent: "invalid",
    "x-request-id": "req-fallback",
  });
  // "invalid" split by "-" has only one part, so parts[1] is undefined
  assertEquals(resolveRequestId(headers), "req-fallback");
});

Deno.test("resolveRequestId handles traceparent with only version", () => {
  const headers = new Headers({
    traceparent: "00",
  });
  const requestId = resolveRequestId(headers);
  // parts[1] is undefined, falls through to UUID generation
  assertMatch(requestId, UUID_REGEX);
});
