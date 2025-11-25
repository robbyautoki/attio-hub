import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDecryptedApiKey, markApiKeyTested, getApiKeyById } from "@/lib/services/api-key.service";
import { testIntegrationConnection } from "@/lib/integrations/registry";
import type { ServiceType } from "@/lib/services/api-key.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the API key metadata first
    const keyMeta = await getApiKeyById(id, userId);
    if (!keyMeta) {
      return NextResponse.json({ error: "API Key nicht gefunden" }, { status: 404 });
    }

    // Get the decrypted key
    const decryptedKey = await getDecryptedApiKey(id, userId);
    if (!decryptedKey) {
      return NextResponse.json({ error: "API Key nicht gefunden" }, { status: 404 });
    }

    // Test the connection
    const result = await testIntegrationConnection(
      keyMeta.service as ServiceType,
      decryptedKey
    );

    // Update the key's validation status
    await markApiKeyTested(id, userId, result.success);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing API key:", error);
    return NextResponse.json(
      { success: false, message: "Fehler beim Testen der Verbindung" },
      { status: 500 }
    );
  }
}
