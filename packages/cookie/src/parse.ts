/**
 * Parse cookies from the Cookie header into an object
 */
export function parseCookies(
  cookieHeader: string | null,
): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const trimmed = cookie.trim();
    if (!trimmed) return;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      // Cookie without value, skip it
      return;
    }

    const name = trimmed.substring(0, equalIndex);
    const value = trimmed.substring(equalIndex + 1);

    if (!name) {
      // Empty name, skip it
      return;
    }

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      // If decoding fails, use raw value
      cookies[name] = value;
    }
  });

  return cookies;
}
