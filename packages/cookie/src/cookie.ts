import { parseCookies } from "./parse.ts";
import { type CookieSerializeOptions, serializeCookie } from "./serialize.ts";
import { sign, unsignWithSecrets } from "./crypto.ts";

/**
 * Cookie creation options
 */
export interface CookieOptions extends CookieSerializeOptions {
  /** Array of secrets for signing cookies. First secret is used for signing, all are used for verification */
  secrets?: string[];
}

/**
 * A logical cookie container that manages parsing and serialization
 */
export interface Cookie {
  /** The name of the cookie */
  readonly name: string;
  /** Whether this cookie uses signing */
  readonly isSigned: boolean;
  /** The expiration date of the cookie */
  readonly expires?: Date;

  /**
   * Parse the cookie value from a Cookie header
   */
  parse(
    cookieHeader: string | null | undefined,
  ): Promise<any>;

  /**
   * Serialize a value into a Set-Cookie header string
   */
  serialize(value: any, options?: CookieSerializeOptions): Promise<string>;
}

/**
 * Create a logical cookie container for managing a browser cookie from the server
 */
export function createCookie(
  name: string,
  cookieOptions: CookieOptions = {},
): Cookie {
  const {
    secrets,
    ...serializeOptions
  } = cookieOptions;

  return {
    name,
    isSigned: secrets !== undefined && secrets.length > 0,
    expires: serializeOptions.expires,

    async parse(cookieHeader) {
      if (!cookieHeader) return null;

      const cookies = parseCookies(cookieHeader);
      const value = cookies[name];

      if (!value) return null;

      // If cookie is signed, verify and unsign it
      if (secrets && secrets.length > 0) {
        const unsigned = await unsignWithSecrets(value, secrets);
        if (unsigned === null) {
          return null; // Invalid signature
        }

        try {
          return JSON.parse(unsigned);
        } catch {
          return unsigned;
        }
      }

      // Not signed, decode directly
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    },

    async serialize(value, options = {}) {
      // Encode value as JSON
      const stringValue = typeof value === "string"
        ? value
        : JSON.stringify(value);

      // Sign if secrets are provided
      let finalValue = stringValue;
      if (secrets && secrets.length > 0) {
        finalValue = await sign(stringValue, secrets[0]);
      }

      // Merge options
      const mergedOptions: CookieSerializeOptions = {
        ...serializeOptions,
        ...options,
      };

      return serializeCookie(name, finalValue, mergedOptions);
    },
  };
}

/**
 * Check if an object is a Cookie
 */
export function isCookie(object: any): object is Cookie {
  return (
    object != null &&
    typeof object.name === "string" &&
    typeof object.parse === "function" &&
    typeof object.serialize === "function"
  );
}
