import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { toggleWorkflow, getWebhookUrl } from "@/lib/services/workflow.service";

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
    const workflow = await toggleWorkflow(id, userId);

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
    console.error("Error toggling workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Umschalten des Workflows" },
      { status: 500 }
    );
  }
}
