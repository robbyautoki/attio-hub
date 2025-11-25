import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
}

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + authTag.toString("hex"),
    iv: iv.toString("hex"),
  };
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 */
export function decrypt(encryptedData: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");

  // Extract auth tag (last 32 hex chars = 16 bytes)
  const authTag = Buffer.from(
    encryptedData.slice(-AUTH_TAG_LENGTH * 2),
    "hex"
  );
  const encrypted = encryptedData.slice(0, -AUTH_TAG_LENGTH * 2);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Gets the last N characters of a string for display purposes (key hint)
 */
export function getKeyHint(key: string, length: number = 4): string {
  if (key.length <= length) {
    return "*".repeat(key.length);
  }
  return "*".repeat(8) + key.slice(-length);
}

/**
 * Generates a secure random string for webhook secrets
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generates a unique webhook path
 */
export function generateWebhookPath(): string {
  return randomBytes(16).toString("hex");
}
