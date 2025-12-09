import { NextResponse } from "next/server";
import { getWorkflowByWebhookPath } from "@/lib/services/workflow.service";
import {
  createExecutionLog,
  executeCalcomWorkflow,
} from "@/lib/services/execution.service";

// In-memory cache to prevent duplicate webhook processing within a short time window
const processedWebhooks = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 30000; // 30 seconds

function getWebhookUniqueId(payload: Record<string, unknown>): string | null {
  // Cal.com payload structure: payload.payload.uid is the unique booking identifier
  const payloadData = payload.payload as Record<string, unknown> | undefined;
  return (payloadData?.uid as string) || null;
}

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

    // Idempotency check: Prevent duplicate webhook processing
    const webhookUid = getWebhookUniqueId(payload);
    if (webhookUid) {
      const cacheKey = `${workflow.id}:${webhookUid}`;
      const lastProcessed = processedWebhooks.get(cacheKey);

      if (lastProcessed && Date.now() - lastProcessed < DUPLICATE_WINDOW_MS) {
        console.log(`Duplicate webhook ignored for ${workflow.name}: ${webhookUid}`);
        return NextResponse.json({
          success: true,
          message: "Webhook already processed (duplicate ignored)",
          durationMs: Date.now() - startTime,
        });
      }

      // Mark as processed immediately to prevent race conditions
      processedWebhooks.set(cacheKey, Date.now());

      // Clean up old entries periodically
      if (processedWebhooks.size > 1000) {
        const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
        for (const [key, timestamp] of processedWebhooks.entries()) {
          if (timestamp < cutoff) {
            processedWebhooks.delete(key);
          }
        }
      }
    }

    console.log(`Webhook received for workflow ${workflow.name}:`, {
      triggerEvent: payload.triggerEvent,
      webhookUid,
      timestamp: new Date().toISOString(),
    });

    // Create execution log
    const log = await createExecutionLog(workflow.id, "webhook", payload);

    // Execute workflow in background (don't block the response)
    // This allows Cal.com to receive an immediate response while we process
    executeCalcomWorkflow(workflow, payload, log.id).catch((error) => {
      console.error(`Background workflow execution failed for ${workflow.id}:`, error);
    });

    // Respond immediately - Cal.com doesn't have to wait
    return NextResponse.json({
      success: true,
      executionId: log.id,
      message: "Webhook received, processing in background",
      durationMs: Date.now() - startTime,
    });
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
