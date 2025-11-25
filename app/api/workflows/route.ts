import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createWorkflow,
  getWorkflowsByUser,
  getWebhookUrl,
  type TriggerType,
} from "@/lib/services/workflow.service";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflows = await getWorkflowsByUser(userId);

    // Add webhook URL to each workflow
    const workflowsWithUrls = workflows.map((w) => ({
      ...w,
      webhookUrl: w.webhookPath ? getWebhookUrl(w.webhookPath) : null,
    }));

    return NextResponse.json(workflowsWithUrls);
  } catch (error) {
    console.error("Error fetching workflows:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Workflows" },
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
    const { name, description, triggerType, triggerConfig, requiredIntegrations } = body;

    if (!name || !triggerType) {
      return NextResponse.json(
        { error: "Name und Trigger-Typ sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate trigger type
    const validTriggerTypes: TriggerType[] = ["webhook", "manual", "schedule"];
    if (!validTriggerTypes.includes(triggerType)) {
      return NextResponse.json(
        { error: "Ungültiger Trigger-Typ" },
        { status: 400 }
      );
    }

    const workflow = await createWorkflow(userId, {
      name,
      description,
      triggerType: triggerType as TriggerType,
      triggerConfig,
      requiredIntegrations,
    });

    return NextResponse.json({
      ...workflow,
      webhookUrl: workflow.webhookPath ? getWebhookUrl(workflow.webhookPath) : null,
    });
  } catch (error) {
    console.error("Error creating workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Workflows" },
      { status: 500 }
    );
  }
}
