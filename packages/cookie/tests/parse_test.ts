import { assertEquals } from "@std/assert";
import { parseCookies } from "../src/parse.ts";

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
