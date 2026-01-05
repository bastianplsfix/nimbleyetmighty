/**
 * @bastianplsfix/cookie
 *
 * A cookie management library for Nimble framework
 * Inspired by Remix's cookie implementation
 */

export {
  type Cookie,
  type CookieOptions,
  createCookie,
  isCookie,
} from "./src/cookie.ts";

export { parseCookies } from "./src/parse.ts";

export {
  type CookieSerializeOptions,
  serializeCookie,
} from "./src/serialize.ts";

export { sign, unsign, unsignWithSecrets } from "./src/crypto.ts";
