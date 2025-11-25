import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getApiKeyById,
  updateApiKey,
  deleteApiKey,
} from "@/lib/services/api-key.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const key = await getApiKeyById(id, userId);

    if (!key) {
      return NextResponse.json({ error: "API Key nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({
      id: key.id,
      name: key.name,
      service: key.service,
      keyHint: key.keyHint,
      isValid: key.isValid,
      lastTestedAt: key.lastTestedAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching API key:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des API Keys" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updated = await updateApiKey(id, userId, {
      name: body.name,
      apiKey: body.apiKey,
    });

    if (!updated) {
      return NextResponse.json({ error: "API Key nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      service: updated.service,
      keyHint: updated.keyHint,
      isValid: updated.isValid,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des API Keys" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteApiKey(id, userId);

    if (!deleted) {
      return NextResponse.json({ error: "API Key nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des API Keys" },
      { status: 500 }
    );
  }
}
