import { assertEquals, assertThrows } from "@std/assert";
import { serializeCookie } from "../src/serialize.ts";

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
