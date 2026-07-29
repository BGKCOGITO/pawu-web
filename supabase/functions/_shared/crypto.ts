const encoder = new TextEncoder();

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function randomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function randomDigits(length = 6) {
  const max = 10 ** length;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % max).padStart(length, "0");
}

export async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value),
  );
  return bytesToHex(new Uint8Array(hash));
}

export async function hmacSha256Hex(
  key: string,
  value: string,
) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(value),
  );

  return bytesToHex(new Uint8Array(signature));
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}
