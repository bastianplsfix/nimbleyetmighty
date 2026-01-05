/**
 * Cookie serialization options
 */
export interface CookieSerializeOptions {
  /** Expiration date of the cookie */
  expires?: Date;
  /** Number of seconds until the cookie expires */
  maxAge?: number;
  /** Domain where the cookie is available */
  domain?: string;
  /** Path where the cookie is available */
  path?: string;
  /** Cookie is only sent over HTTPS */
  secure?: boolean;
  /** Cookie is inaccessible to JavaScript */
  httpOnly?: boolean;
  /** Controls when cookies are sent with cross-site requests */
  sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
}

/**
 * Serialize a cookie name-value pair into a Set-Cookie header string
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieSerializeOptions = {},
): string {
  if (!name) {
    throw new TypeError("Cookie name cannot be empty");
  }

  const encodedValue = encodeURIComponent(value);
  let cookie = `${name}=${encodedValue}`;

  if (options.maxAge !== undefined) {
    if (!Number.isInteger(options.maxAge)) {
      throw new TypeError("maxAge must be an integer");
    }
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (options.expires) {
    if (!(options.expires instanceof Date)) {
      throw new TypeError("expires must be a Date object");
    }
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.secure) {
    cookie += "; Secure";
  }

  if (options.httpOnly) {
    cookie += "; HttpOnly";
  }

  if (options.sameSite) {
    const sameSite = options.sameSite.toLowerCase();
    switch (sameSite) {
      case "strict":
        cookie += "; SameSite=Strict";
        break;
      case "lax":
        cookie += "; SameSite=Lax";
        break;
      case "none":
        cookie += "; SameSite=None";
        break;
      default:
        throw new TypeError(
          "sameSite must be Strict, Lax, or None",
        );
    }
  }

  return cookie;
}
