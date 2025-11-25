import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  getWebhookUrl,
} from "@/lib/services/workflow.service";

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
    const workflow = await getWorkflowById(id, userId);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...workflow,
      webhookUrl: workflow.webhookPath ? getWebhookUrl(workflow.webhookPath) : null,
    });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Workflows" },
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

    const updated = await updateWorkflow(id, userId, body);

    if (!updated) {
      return NextResponse.json(
        { error: "Workflow nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updated,
      webhookUrl: updated.webhookPath ? getWebhookUrl(updated.webhookPath) : null,
    });
  } catch (error) {
    console.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Workflows" },
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
    const deleted = await deleteWorkflow(id, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Workflow nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Workflows" },
      { status: 500 }
    );
  }
}
