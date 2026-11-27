// AES-GCM under a key derived from a configured secret by SHA-256. A sealed
// value is `<iv base64>:<ciphertext base64>`; TOTP secrets already stored in
// that form must keep opening, so the format does not change.
const IV_BYTES = 12;
const ALGORITHM = "AES-GCM";

async function deriveKey(keyMaterial: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(keyMaterial),
  );
  return crypto.subtle.importKey("raw", digest, ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealSecret(
  keyMaterial: string,
  plain: string,
): Promise<string> {
  const key = await deriveKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${Buffer.from(iv).toString("base64")}:${Buffer.from(cipher).toString("base64")}`;
}

export async function openSecret(
  keyMaterial: string,
  sealed: string,
): Promise<string> {
  const [ivRaw, cipherRaw] = sealed.split(":");
  if (!ivRaw || !cipherRaw) {
    throw new Error("Invalid sealed secret");
  }
  const key = await deriveKey(keyMaterial);
  const plain = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: Buffer.from(ivRaw, "base64") },
    key,
    Buffer.from(cipherRaw, "base64"),
  );
  return new TextDecoder().decode(plain);
}
