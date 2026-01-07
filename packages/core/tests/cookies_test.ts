import { assertEquals, assertThrows } from "@std/assert";
import { parseCookies, serializeCookie } from "../src/cookies.ts";

// Parse tests
Deno.test("parseCookies returns empty object for null", () => {
  assertEquals(parseCookies(null), {});
});

Deno.test("parseCookies returns empty object for empty string", () => {
  assertEquals(parseCookies(""), {});
});

Deno.test("parseCookies parses single cookie", () => {
  assertEquals(parseCookies("token=abc123"), { token: "abc123" });
});

Deno.test("parseCookies parses multiple cookies", () => {
  assertEquals(parseCookies("token=abc123; session=xyz789"), {
    token: "abc123",
    session: "xyz789",
  });
});

Deno.test("parseCookies handles whitespace", () => {
  assertEquals(parseCookies("  token=abc123  ;  session=xyz789  "), {
    token: "abc123",
    session: "xyz789",
  });
});

Deno.test("parseCookies handles cookie value with equals sign", () => {
  assertEquals(parseCookies("data=base64==encoded"), {
    data: "base64==encoded",
  });
});

Deno.test("parseCookies handles empty cookie value", () => {
  assertEquals(parseCookies("empty="), { empty: "" });
});

Deno.test("parseCookies handles URL-encoded cookie values", () => {
  assertEquals(parseCookies("json=%7B%22key%22%3A%22value%22%7D"), {
    json: '{"key":"value"}',
  });
});

Deno.test("parseCookies skips cookies without equals sign", () => {
  assertEquals(parseCookies("valid=value; invalid"), {
    valid: "value",
  });
});

Deno.test("parseCookies skips cookies with empty name", () => {
  assertEquals(parseCookies("=value; valid=test"), {
    valid: "test",
  });
});

Deno.test("parseCookies handles malformed URL encoding gracefully", () => {
  assertEquals(parseCookies("bad=%E0%A4%A"), {
    bad: "%E0%A4%A", // Falls back to raw value if decoding fails
  });
});

// Serialize tests
Deno.test("serializeCookie creates basic cookie", () => {
  assertEquals(serializeCookie("token", "abc123"), "token=abc123");
});

Deno.test("serializeCookie encodes cookie value", () => {
  assertEquals(
    serializeCookie("data", "hello world"),
    "data=hello%20world",
  );
});

Deno.test("serializeCookie adds maxAge", () => {
  assertEquals(
    serializeCookie("token", "abc123", { maxAge: 3600 }),
    "token=abc123; Max-Age=3600",
  );
});

Deno.test("serializeCookie adds expires", () => {
  const date = new Date("2025-01-01T00:00:00.000Z");
  assertEquals(
    serializeCookie("token", "abc123", { expires: date }),
    "token=abc123; Expires=Wed, 01 Jan 2025 00:00:00 GMT",
  );
});

Deno.test("serializeCookie adds domain", () => {
  assertEquals(
    serializeCookie("token", "abc123", { domain: "example.com" }),
    "token=abc123; Domain=example.com",
  );
});

Deno.test("serializeCookie adds path", () => {
  assertEquals(
    serializeCookie("token", "abc123", { path: "/api" }),
    "token=abc123; Path=/api",
  );
});

Deno.test("serializeCookie adds secure flag", () => {
  assertEquals(
    serializeCookie("token", "abc123", { secure: true }),
    "token=abc123; Secure",
  );
});

Deno.test("serializeCookie adds httpOnly flag", () => {
  assertEquals(
    serializeCookie("token", "abc123", { httpOnly: true }),
    "token=abc123; HttpOnly",
  );
});

Deno.test("serializeCookie adds sameSite=Strict", () => {
  assertEquals(
    serializeCookie("token", "abc123", { sameSite: "Strict" }),
    "token=abc123; SameSite=Strict",
  );
});

Deno.test("serializeCookie adds sameSite=Lax", () => {
  assertEquals(
    serializeCookie("token", "abc123", { sameSite: "Lax" }),
    "token=abc123; SameSite=Lax",
  );
});

Deno.test("serializeCookie adds sameSite=None", () => {
  assertEquals(
    serializeCookie("token", "abc123", { sameSite: "None" }),
    "token=abc123; SameSite=None",
  );
});

Deno.test("serializeCookie handles lowercase sameSite", () => {
  assertEquals(
    serializeCookie("token", "abc123", { sameSite: "strict" }),
    "token=abc123; SameSite=Strict",
  );
});

Deno.test("serializeCookie combines multiple options", () => {
  assertEquals(
    serializeCookie("session", "xyz789", {
      maxAge: 3600,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Strict",
    }),
    "session=xyz789; Max-Age=3600; Path=/; Secure; HttpOnly; SameSite=Strict",
  );
});

Deno.test("serializeCookie throws on empty name", () => {
  assertThrows(
    () => serializeCookie("", "value"),
    TypeError,
    "Cookie name cannot be empty",
  );
});

Deno.test("serializeCookie throws on non-integer maxAge", () => {
  assertThrows(
    () => serializeCookie("token", "value", { maxAge: 3.14 }),
    TypeError,
    "maxAge must be an integer",
  );
});

Deno.test("serializeCookie throws on invalid expires", () => {
  assertThrows(
    () => serializeCookie("token", "value", { expires: "not a date" as any }),
    TypeError,
    "expires must be a Date object",
  );
});

Deno.test("serializeCookie throws on invalid sameSite", () => {
  assertThrows(
    () => serializeCookie("token", "value", { sameSite: "invalid" as any }),
    TypeError,
    "sameSite must be Strict, Lax, or None",
  );
});
