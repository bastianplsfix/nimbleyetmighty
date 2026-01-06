# @bastianplsfix/cookie

A secure, Remix-inspired cookie management library for Nimble framework. Provides type-safe HTTP cookie handling with cryptographic signing, secret rotation, and a clean API.

## Installation

```typescript
import { createCookie } from "@bastianplsfix/nimble";
// or directly
import { createCookie } from "@bastianplsfix/cookie";
```

## Quick Start

### Creating a Cookie

```typescript
import { createCookie } from "@bastianplsfix/cookie";

// Simple cookie
const sessionCookie = createCookie("session");

// Cookie with options
const userCookie = createCookie("user_prefs", {
  maxAge: 60 * 60 * 24 * 7, // 1 week
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
});

// Signed cookie (prevents tampering)
const authCookie = createCookie("auth", {
  secrets: ["your-secret-key"],
  httpOnly: true,
  secure: true,
});
```

### Parsing Cookies

```typescript
// In your route handler
route.get("/profile", async ({ request }) => {
  const session = await sessionCookie.parse(
    request.headers.get("Cookie")
  );
  
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  
  return Response.json({ user: session.username });
});
```

### Setting Cookies

```typescript
route.post("/login", async ({ request }) => {
  const { username } = await request.json();
  
  const sessionData = {
    userId: crypto.randomUUID(),
    username,
    loginTime: new Date().toISOString(),
  };
  
  return Response.json(
    { message: "Logged in" },
    {
      headers: {
        "Set-Cookie": await sessionCookie.serialize(sessionData),
      },
    }
  );
});
```

### Deleting Cookies

```typescript
route.post("/logout", async () => {
  return new Response("Logged out", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
});
```

## API Reference

### `createCookie(name, options?)`

Creates a logical cookie container for managing a browser cookie from the server.

**Parameters:**
- `name` (string) - Cookie identifier
- `options` (optional) - Configuration options

**Options:**
- `secrets?: string[]` - Array of secrets for signing. First secret is used for signing, all are tried for verification
- `expires?: Date` - Expiration date
- `maxAge?: number` - Seconds until expiration (takes precedence over expires)
- `domain?: string` - Domain where cookie is available
- `path?: string` - Path where cookie is available (default: "/")
- `secure?: boolean` - Cookie only sent over HTTPS
- `httpOnly?: boolean` - Cookie inaccessible to JavaScript
- `sameSite?: "Strict" | "Lax" | "None"` - Controls cross-site cookie behavior

**Returns:** `Cookie` object with methods:
- `parse(cookieHeader)` - Extract and verify cookie value
- `serialize(value, options?)` - Create Set-Cookie header
- `name` - Cookie name
- `isSigned` - Whether cookie uses signing
- `expires` - Expiration date (if set)

### `parseCookies(cookieHeader)`

Low-level function to parse Cookie header into an object.

```typescript
const cookies = parseCookies(request.headers.get("Cookie"));
// { session: "abc123", theme: "dark" }
```

### `serializeCookie(name, value, options?)`

Low-level function to create a Set-Cookie header string.

```typescript
const header = serializeCookie("session", "abc123", {
  httpOnly: true,
  maxAge: 3600,
});
// "session=abc123; HttpOnly; Max-Age=3600"
```

## Security Best Practices

### 1. Always Use Secrets for Sensitive Data

```typescript
// ✅ Good - signed cookie
const authCookie = createCookie("auth", {
  secrets: ["strong-random-secret"],
  httpOnly: true,
  secure: true,
});

// ❌ Bad - unsigned cookie for auth
const authCookie = createCookie("auth");
```

### 2. Rotate Secrets Regularly

```typescript
// Add new secret to the front, keep old ones for verification
const authCookie = createCookie("auth", {
  secrets: [
    "new-secret-2025-01",    // Used for new cookies
    "old-secret-2024-12",    // Still validates old cookies
    "older-secret-2024-11",  // Fallback
  ],
});
```

### 3. Use Appropriate Security Flags

```typescript
const secureCookie = createCookie("session", {
  httpOnly: true,   // Prevent XSS attacks
  secure: true,     // HTTPS only
  sameSite: "Lax",  // CSRF protection
});
```

### 4. Set Appropriate Expiration

```typescript
// Short-lived session
const sessionCookie = createCookie("session", {
  maxAge: 60 * 60, // 1 hour
});

// Long-lived preferences
const prefsCookie = createCookie("prefs", {
  maxAge: 60 * 60 * 24 * 365, // 1 year
});
```

## Examples

### Signed Session Cookie

```typescript
const sessionCookie = createCookie("session", {
  secrets: ["your-secret-key"],
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  maxAge: 60 * 60 * 24 * 7, // 1 week
});

// Set session
route.post("/login", async ({ request }) => {
  const session = { userId: "123", role: "admin" };
  return new Response("OK", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize(session),
    },
  });
});

// Read session
route.get("/profile", async ({ request }) => {
  const session = await sessionCookie.parse(
    request.headers.get("Cookie")
  );
  // session is null if signature is invalid or cookie missing
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(session);
});
```

### User Preferences (No Signing)

```typescript
const prefsCookie = createCookie("prefs", {
  httpOnly: false, // Allow client-side access
  secure: true,
  maxAge: 60 * 60 * 24 * 365,
});

route.get("/preferences", async ({ request }) => {
  const prefs = await prefsCookie.parse(
    request.headers.get("Cookie")
  ) || { theme: "light", lang: "en" };
  
  return Response.json(prefs);
});

route.post("/preferences", async ({ request }) => {
  const prefs = await request.json();
  return Response.json(prefs, {
    headers: {
      "Set-Cookie": await prefsCookie.serialize(prefs),
    },
  });
});
```

### Secret Rotation

```typescript
// Start with one secret
const cookie = createCookie("session", {
  secrets: ["secret-v1"],
});

// Later, rotate to new secret while keeping old one
const cookie = createCookie("session", {
  secrets: [
    "secret-v2", // New cookies signed with this
    "secret-v1", // Old cookies still work
  ],
});

// Even later, remove oldest secret
const cookie = createCookie("session", {
  secrets: [
    "secret-v3",
    "secret-v2",
    // secret-v1 removed - cookies signed with it won't work
  ],
});
```

## License

MIT

## Credits

Inspired by [Remix's cookie implementation](https://remix.run/docs/utils/cookies).
