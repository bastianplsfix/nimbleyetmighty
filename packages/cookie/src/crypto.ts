/**
 * Sign a value using HMAC-SHA256
 */
export async function sign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${value}.${signatureHex}`;
}

/**
 * Verify and extract a signed value
 * Returns the original value if signature is valid, null otherwise
 */
export async function unsign(
  signedValue: string,
  secret: string,
): Promise<string | null> {
  const lastDotIndex = signedValue.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return null;
  }

  const value = signedValue.substring(0, lastDotIndex);
  const signature = signedValue.substring(lastDotIndex + 1);

  const expectedSigned = await sign(value, secret);
  const expectedSignature = expectedSigned.substring(
    expectedSigned.lastIndexOf(".") + 1,
  );

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return mismatch === 0 ? value : null;
}

/**
 * Attempt to unsign a value using multiple secrets (for secret rotation)
 * Tries secrets in order until one works
 */
export async function unsignWithSecrets(
  signedValue: string,
  secrets: string[],
): Promise<string | null> {
  for (const secret of secrets) {
    const value = await unsign(signedValue, secret);
    if (value !== null) {
      return value;
    }
  }
  return null;
}
