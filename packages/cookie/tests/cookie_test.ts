import { assertEquals } from "@std/assert";
import { createCookie, isCookie } from "../src/cookie.ts";

Deno.test("createCookie creates a cookie object", () => {
  const cookie = createCookie("session");
  assertEquals(cookie.name, "session");
  assertEquals(cookie.isSigned, false);
});

Deno.test("createCookie with secrets marks as signed", () => {
  const cookie = createCookie("session", { secrets: ["secret"] });
  assertEquals(cookie.isSigned, true);
});

Deno.test("isCookie validates cookie objects", () => {
  const cookie = createCookie("test");
  assertEquals(isCookie(cookie), true);
  assertEquals(isCookie({}), false);
  assertEquals(isCookie(null), false);
});

Deno.test("cookie.parse returns null for empty header", async () => {
  const cookie = createCookie("session");
  assertEquals(await cookie.parse(null), null);
  assertEquals(await cookie.parse(""), null);
});

Deno.test("cookie.parse extracts cookie value", async () => {
  const cookie = createCookie("token");
  const value = await cookie.parse("token=abc123");
  assertEquals(value, "abc123");
});

Deno.test("cookie.parse extracts cookie from multiple cookies", async () => {
  const cookie = createCookie("session");
  const value = await cookie.parse("other=value; session=xyz789; another=test");
  assertEquals(value, "xyz789");
});

Deno.test("cookie.parse returns null for missing cookie", async () => {
  const cookie = createCookie("missing");
  const value = await cookie.parse("other=value; another=test");
  assertEquals(value, null);
});

Deno.test("cookie.parse parses JSON values", async () => {
  const cookie = createCookie("data");
  const value = await cookie.parse('data={"user":"john","age":30}');
  assertEquals(value, { user: "john", age: 30 });
});

Deno.test("cookie.parse returns string for non-JSON", async () => {
  const cookie = createCookie("simple");
  const value = await cookie.parse("simple=just-a-string");
  assertEquals(value, "just-a-string");
});

Deno.test("cookie.serialize creates Set-Cookie header", async () => {
  const cookie = createCookie("token");
  const header = await cookie.serialize("abc123");
  assertEquals(header, "token=abc123");
});

Deno.test("cookie.serialize with string value", async () => {
  const cookie = createCookie("session");
  const header = await cookie.serialize("xyz789");
  assertEquals(header, "session=xyz789");
});

Deno.test("cookie.serialize with object value", async () => {
  const cookie = createCookie("data");
  const header = await cookie.serialize({ user: "john" });
  assertEquals(header.startsWith("data="), true);
  assertEquals(header.includes("user"), true);
});

Deno.test("cookie.serialize applies default options", async () => {
  const cookie = createCookie("session", {
    path: "/",
    httpOnly: true,
    secure: true,
  });
  const header = await cookie.serialize("value");
  assertEquals(header.includes("Path=/"), true);
  assertEquals(header.includes("HttpOnly"), true);
  assertEquals(header.includes("Secure"), true);
});

Deno.test("cookie.serialize merges custom options", async () => {
  const cookie = createCookie("session", { path: "/" });
  const header = await cookie.serialize("value", {
    maxAge: 3600,
    sameSite: "Strict",
  });
  assertEquals(header.includes("Path=/"), true);
  assertEquals(header.includes("Max-Age=3600"), true);
  assertEquals(header.includes("SameSite=Strict"), true);
});

Deno.test("signed cookie round trip", async () => {
  const cookie = createCookie("session", { secrets: ["my-secret"] });

  // Serialize
  const header = await cookie.serialize({ userId: "123" });

  // Extract cookie value from Set-Cookie header
  const cookieValue = header.split(";")[0].split("=")[1];

  // Parse back
  const parsed = await cookie.parse(`session=${cookieValue}`);
  assertEquals(parsed, { userId: "123" });
});

Deno.test("signed cookie with invalid signature returns null", async () => {
  const cookie = createCookie("session", { secrets: ["secret1"] });

  // Try to parse a cookie signed with different secret
  const otherCookie = createCookie("session", { secrets: ["secret2"] });
  const header = await otherCookie.serialize("data");
  const cookieValue = header.split(";")[0].split("=")[1];

  const parsed = await cookie.parse(`session=${cookieValue}`);
  assertEquals(parsed, null);
});

Deno.test("signed cookie supports secret rotation", async () => {
  const oldCookie = createCookie("session", { secrets: ["old-secret"] });
  const header = await oldCookie.serialize({ user: "john" });
  const cookieValue = header.split(";")[0].split("=")[1];

  // New cookie with rotated secrets (new secret first, old secret second)
  const newCookie = createCookie("session", {
    secrets: ["new-secret", "old-secret"],
  });

  // Should still be able to parse cookie signed with old secret
  const parsed = await newCookie.parse(`session=${cookieValue}`);
  assertEquals(parsed, { user: "john" });
});

Deno.test("cookie.expires is accessible", () => {
  const date = new Date("2025-12-31");
  const cookie = createCookie("session", { expires: date });
  assertEquals(cookie.expires, date);
});

Deno.test("cookie without expires has undefined expires", () => {
  const cookie = createCookie("session");
  assertEquals(cookie.expires, undefined);
});
