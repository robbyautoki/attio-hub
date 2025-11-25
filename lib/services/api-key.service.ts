import { db } from "@/lib/db";
import { apiKeys, type ApiKey, type NewApiKey } from "@/lib/db/schema";
import { encrypt, decrypt, getKeyHint } from "@/lib/crypto";
import { eq, and } from "drizzle-orm";

export type ServiceType = "attio" | "klaviyo" | "calcom" | "resend";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  attio: "Attio CRM",
  klaviyo: "Klaviyo",
  calcom: "Cal.com",
  resend: "Resend",
};

/**
 * Creates a new API key (encrypted)
 */
export async function createApiKey(
  userId: string,
  name: string,
  service: ServiceType,
  apiKey: string
): Promise<ApiKey> {
  const { encrypted, iv } = encrypt(apiKey);
  const keyHint = getKeyHint(apiKey);

  const id = crypto.randomUUID();
  const now = new Date();

  const [newKey] = await db
    .insert(apiKeys)
    .values({
      id,
      userId,
      name,
      service,
      encryptedKey: encrypted,
      encryptedKeyIv: iv,
      keyHint,
      isValid: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newKey;
}

/**
 * Gets all API keys for a user (without decrypting)
 */
export async function getApiKeysByUser(userId: string): Promise<ApiKey[]> {
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
}

/**
 * Gets a single API key by ID
 */
export async function getApiKeyById(
  id: string,
  userId: string
): Promise<ApiKey | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  return key || null;
}

/**
 * Gets a decrypted API key value (use carefully!)
 */
export async function getDecryptedApiKey(
  id: string,
  userId: string
): Promise<string | null> {
  const key = await getApiKeyById(id, userId);
  if (!key) return null;

  return decrypt(key.encryptedKey, key.encryptedKeyIv);
}

/**
 * Gets a decrypted API key by service type
 */
export async function getDecryptedApiKeyByService(
  userId: string,
  service: ServiceType
): Promise<string | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.service, service)));

  if (!key) return null;

  return decrypt(key.encryptedKey, key.encryptedKeyIv);
}

/**
 * Updates an API key
 */
export async function updateApiKey(
  id: string,
  userId: string,
  updates: {
    name?: string;
    apiKey?: string;
    isValid?: boolean;
  }
): Promise<ApiKey | null> {
  const existing = await getApiKeyById(id, userId);
  if (!existing) return null;

  const updateData: Partial<NewApiKey> = {
    updatedAt: new Date(),
  };

  if (updates.name) {
    updateData.name = updates.name;
  }

  if (updates.apiKey) {
    const { encrypted, iv } = encrypt(updates.apiKey);
    updateData.encryptedKey = encrypted;
    updateData.encryptedKeyIv = iv;
    updateData.keyHint = getKeyHint(updates.apiKey);
  }

  if (updates.isValid !== undefined) {
    updateData.isValid = updates.isValid;
  }

  const [updated] = await db
    .update(apiKeys)
    .set(updateData)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning();

  return updated;
}

/**
 * Deletes an API key
 */
export async function deleteApiKey(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  return result.rowsAffected > 0;
}

/**
 * Marks an API key as tested
 */
export async function markApiKeyTested(
  id: string,
  userId: string,
  isValid: boolean
): Promise<void> {
  await db
    .update(apiKeys)
    .set({
      isValid,
      lastTestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}
