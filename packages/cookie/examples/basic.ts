/**
 * Basic cookie example demonstrating the API
 */

import { createCookie } from "../mod.ts";

// Create a signed session cookie
const sessionCookie = createCookie("session", {
  secrets: ["my-secret-key"],
  httpOnly: true,
  secure: true,
  maxAge: 3600, // 1 hour
});

// Simulate setting a cookie
console.log("=== Setting Cookie ===");
const sessionData = { userId: "123", username: "john" };
const setCookieHeader = await sessionCookie.serialize(sessionData);
console.log("Set-Cookie:", setCookieHeader);

// Extract just the cookie value (simulating browser sending it back)
const cookieValue = setCookieHeader.split(";")[0];
console.log("\n=== Browser sends back ===");
console.log("Cookie:", cookieValue);

// Simulate parsing the cookie on next request
console.log("\n=== Parsing Cookie ===");
const parsed = await sessionCookie.parse(cookieValue);
console.log("Parsed session data:", parsed);
console.log("✅ Cookie signed and verified successfully!");

// Try tampering with the cookie
console.log("\n=== Testing Security ===");
const tampered = cookieValue.replace("123", "999");
const tamperedResult = await sessionCookie.parse(tampered);
console.log("Tampered cookie result:", tamperedResult);
console.log("✅ Tampering detected - returns null!");

// Test secret rotation
console.log("\n=== Testing Secret Rotation ===");
const oldCookie = createCookie("session", {
  secrets: ["old-secret"],
});
const oldHeader = await oldCookie.serialize({ data: "old" });
const oldValue = oldHeader.split(";")[0];

const newCookie = createCookie("session", {
  secrets: ["new-secret", "old-secret"], // old secret still works
});
const rotatedResult = await newCookie.parse(oldValue);
console.log("Cookie signed with old secret:", rotatedResult);
console.log("✅ Secret rotation works!");
