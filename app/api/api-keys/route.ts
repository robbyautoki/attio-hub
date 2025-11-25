import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createApiKey,
  getApiKeysByUser,
  type ServiceType,
} from "@/lib/services/api-key.service";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await getApiKeysByUser(userId);

    // Don't return encrypted keys to the client
    const safeKeys = keys.map((key) => ({
      id: key.id,
      name: key.name,
      service: key.service,
      keyHint: key.keyHint,
      isValid: key.isValid,
      lastTestedAt: key.lastTestedAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));

    return NextResponse.json(safeKeys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der API Keys" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, service, apiKey } = body;

    if (!name || !service || !apiKey) {
      return NextResponse.json(
        { error: "Name, Service und API Key sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate service type
    const validServices: ServiceType[] = ["attio", "klaviyo", "calcom", "resend"];
    if (!validServices.includes(service)) {
      return NextResponse.json(
        { error: "Ungültiger Service-Typ" },
        { status: 400 }
      );
    }

    const newKey = await createApiKey(userId, name, service as ServiceType, apiKey);

    return NextResponse.json({
      id: newKey.id,
      name: newKey.name,
      service: newKey.service,
      keyHint: newKey.keyHint,
      isValid: newKey.isValid,
      createdAt: newKey.createdAt,
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des API Keys" },
      { status: 500 }
    );
  }
}
