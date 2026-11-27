import { totpConfig } from "~/server/platform/config/env";
import { openSecret, sealSecret } from "~/server/platform/crypto/sealed-secret";

export function encryptTotpSecret(secret: string): Promise<string> {
  return sealSecret(totpConfig().totpEncryptionKey, secret);
}

export function decryptTotpSecret(value: string): Promise<string> {
  return openSecret(totpConfig().totpEncryptionKey, value);
}
