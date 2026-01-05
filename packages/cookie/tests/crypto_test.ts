import { assertEquals } from "@std/assert";
import { sign, unsign, unsignWithSecrets } from "../src/crypto.ts";

Deno.test("sign creates signed value", async () => {
  const signed = await sign("hello", "secret");
  assertEquals(typeof signed, "string");
  assertEquals(signed.includes("."), true);
  assertEquals(signed.startsWith("hello."), true);
});

Deno.test("unsign verifies and extracts value", async () => {
  const signed = await sign("test-value", "my-secret");
  const unsigned = await unsign(signed, "my-secret");
  assertEquals(unsigned, "test-value");
});

Deno.test("unsign returns null for invalid signature", async () => {
  const signed = await sign("value", "secret1");
  const unsigned = await unsign(signed, "secret2");
  assertEquals(unsigned, null);
});

Deno.test("unsign returns null for tampered value", async () => {
  const signed = await sign("value", "secret");
  const tampered = "tampered" + signed.substring(8);
  const unsigned = await unsign(tampered, "secret");
  assertEquals(unsigned, null);
});

Deno.test("unsign returns null for malformed signed value", async () => {
  const unsigned = await unsign("no-signature-here", "secret");
  assertEquals(unsigned, null);
});

Deno.test("unsignWithSecrets tries multiple secrets", async () => {
  const signed = await sign("value", "old-secret");
  const unsigned = await unsignWithSecrets(signed, [
    "new-secret",
    "old-secret",
  ]);
  assertEquals(unsigned, "value");
});

Deno.test("unsignWithSecrets returns null if no secret works", async () => {
  const signed = await sign("value", "secret");
  const unsigned = await unsignWithSecrets(signed, ["wrong1", "wrong2"]);
  assertEquals(unsigned, null);
});

Deno.test("sign produces consistent signatures", async () => {
  const signed1 = await sign("value", "secret");
  const signed2 = await sign("value", "secret");
  assertEquals(signed1, signed2);
});

Deno.test("sign produces different signatures for different secrets", async () => {
  const signed1 = await sign("value", "secret1");
  const signed2 = await sign("value", "secret2");
  assertEquals(signed1 === signed2, false);
});

Deno.test("sign handles complex values", async () => {
  const complexValue = JSON.stringify({ user: "john", role: "admin" });
  const signed = await sign(complexValue, "secret");
  const unsigned = await unsign(signed, "secret");
  assertEquals(unsigned, complexValue);
});
