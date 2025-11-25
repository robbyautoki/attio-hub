import { NextResponse } from "next/server";
import { getWorkflowByWebhookPath } from "@/lib/services/workflow.service";
import {
  createExecutionLog,
  executeCalcomWorkflow,
} from "@/lib/services/execution.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const startTime = Date.now();

  try {
    const { workflowId } = await params;

    // Get workflow by webhook path
    const workflow = await getWorkflowByWebhookPath(workflowId);

    if (!workflow) {
      console.log(`Webhook received for unknown workflow: ${workflowId}`);
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    if (!workflow.isEnabled) {
      console.log(`Webhook received for disabled workflow: ${workflow.id}`);
      return NextResponse.json(
        { error: "Workflow is disabled" },
        { status: 400 }
      );
    }

    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    console.log(`Webhook received for workflow ${workflow.name}:`, {
      triggerEvent: payload.triggerEvent,
      timestamp: new Date().toISOString(),
    });

    // Create execution log
    const log = await createExecutionLog(workflow.id, "webhook", payload);

    // Execute the workflow asynchronously
    // For now, we execute synchronously and respond with the result
    // In production, you might want to use a queue for this
    try {
      await executeCalcomWorkflow(workflow, payload, log.id);

      return NextResponse.json({
        success: true,
        executionId: log.id,
        message: "Workflow executed successfully",
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      console.error(`Workflow execution failed for ${workflow.id}:`, error);

      return NextResponse.json({
        success: false,
        executionId: log.id,
        message: "Workflow execution failed",
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      });
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for testing the endpoint exists
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const workflow = await getWorkflowByWebhookPath(workflowId);

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({
    message: "Webhook endpoint is active",
    workflow: workflow.name,
    enabled: workflow.isEnabled,
  });
}
