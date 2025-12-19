import { NextResponse } from "next/server";
import { getWorkflowByWebhookPath, incrementExecutionStats } from "@/lib/services/workflow.service";
import { createExecutionLog, updateExecutionLog } from "@/lib/services/execution.service";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";
import { createKlaviyoClient } from "@/lib/integrations/klaviyo";
import { sendSlackNotification } from "@/lib/integrations/slack";

// Lead Sync Webhook Handler
// Receives firstName, lastName, email and syncs to Klaviyo
// Authenticated via Webflow webhook secret

const KLAVIYO_LIST_ID = process.env.KLAVIYO_LEAD_LIST_ID;
const WEBFLOW_WEBHOOK_SECRET = process.env.WEBFLOW_WEBHOOK_SECRET;

interface StepLog {
  name: string;
  status: "success" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: string;
}

interface LeadPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const stepLogs: StepLog[] = [];
  let logId: string | null = null;
  let workflow: Awaited<ReturnType<typeof getWorkflowByWebhookPath>> = null;

  try {
    // Verify Webflow webhook secret (if configured)
    if (WEBFLOW_WEBHOOK_SECRET) {
      const signature = request.headers.get("X-Webflow-Signature");
      if (signature !== WEBFLOW_WEBHOOK_SECRET) {
        console.log("Invalid Webflow signature:", signature);
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Parse payload
    const stepStartParse = Date.now();
    const payload: LeadPayload = await request.json();
    const { firstName, lastName, email } = payload;

    stepLogs.push({
      name: "Parse Payload",
      status: "success",
      input: payload,
      output: { firstName, lastName, email },
      durationMs: Date.now() - stepStartParse,
      timestamp: new Date().toISOString(),
    });

    // Validate required fields
    if (!email) {
      stepLogs.push({
        name: "Validate Email",
        status: "failed",
        error: "Email is required",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get workflow
    const stepStartWorkflow = Date.now();
    workflow = await getWorkflowByWebhookPath("lead-sync");

    if (!workflow) {
      console.log("Lead-sync workflow not found, processing anyway...");
    }

    stepLogs.push({
      name: "Load Workflow",
      status: workflow ? "success" : "skipped",
      output: workflow ? { workflowId: workflow.id, isEnabled: workflow.isEnabled } : null,
      error: workflow ? undefined : "Workflow not found - using default user",
      durationMs: Date.now() - stepStartWorkflow,
      timestamp: new Date().toISOString(),
    });

    // Create execution log if workflow exists
    if (workflow) {
      const log = await createExecutionLog(workflow.id, "webhook", payload);
      logId = log.id;
      await updateExecutionLog(logId, { status: "running" });
    }

    // Get Klaviyo API key
    const stepStartKey = Date.now();
    // Use workflow user or fallback to a default user ID
    const userId = workflow?.userId || "user_35z2IGab17SKuYAG5XU43IQP24v";
    const klaviyoKey = await getDecryptedApiKeyByService(userId, "klaviyo");

    if (!klaviyoKey) {
      stepLogs.push({
        name: "Get Klaviyo API Key",
        status: "failed",
        error: "Klaviyo API key not configured",
        durationMs: Date.now() - stepStartKey,
        timestamp: new Date().toISOString(),
      });

      if (logId) {
        await updateExecutionLog(logId, {
          status: "failed",
          errorMessage: "Klaviyo API key not configured",
          stepLogs,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        });
        if (workflow) await incrementExecutionStats(workflow.id, false);
      }

      return NextResponse.json(
        { error: "Klaviyo API key not configured" },
        { status: 500 }
      );
    }

    stepLogs.push({
      name: "Get Klaviyo API Key",
      status: "success",
      durationMs: Date.now() - stepStartKey,
      timestamp: new Date().toISOString(),
    });

    const klaviyoClient = createKlaviyoClient(klaviyoKey);

    // Step 1: Upsert profile in Klaviyo
    const stepStartUpsert = Date.now();
    try {
      await klaviyoClient.upsertProfile({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });

      stepLogs.push({
        name: "Upsert Klaviyo Profile",
        status: "success",
        input: { email, firstName, lastName },
        output: { synced: true },
        durationMs: Date.now() - stepStartUpsert,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      stepLogs.push({
        name: "Upsert Klaviyo Profile",
        status: "failed",
        input: { email, firstName, lastName },
        error: errorMsg,
        durationMs: Date.now() - stepStartUpsert,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }

    // Step 2: Subscribe to list (if list ID configured)
    if (KLAVIYO_LIST_ID) {
      const stepStartSubscribe = Date.now();
      try {
        await klaviyoClient.subscribeToList(KLAVIYO_LIST_ID, email, firstName || undefined);

        stepLogs.push({
          name: "Subscribe to Klaviyo List",
          status: "success",
          input: { listId: KLAVIYO_LIST_ID, email },
          output: { subscribed: true },
          durationMs: Date.now() - stepStartSubscribe,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        stepLogs.push({
          name: "Subscribe to Klaviyo List",
          status: "failed",
          input: { listId: KLAVIYO_LIST_ID, email },
          error: errorMsg,
          durationMs: Date.now() - stepStartSubscribe,
          timestamp: new Date().toISOString(),
        });
        // Don't throw - continue even if list subscription fails
        console.error("Failed to subscribe to Klaviyo list:", errorMsg);
      }
    } else {
      stepLogs.push({
        name: "Subscribe to Klaviyo List",
        status: "skipped",
        error: "KLAVIYO_LEAD_LIST_ID not configured",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Step 3: Send Slack notification
    const stepStartSlack = Date.now();
    try {
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unbekannt";
      await sendSlackNotification({
        text: `📥 Neuer Lead: ${fullName} (${email})`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📥 Neuer Lead eingegangen",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Name:*\n${fullName}`,
              },
              {
                type: "mrkdwn",
                text: `*E-Mail:*\n${email}`,
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Profil in Klaviyo erstellt${KLAVIYO_LIST_ID ? " und zur Liste hinzugefügt" : ""}`,
              },
            ],
          },
        ],
      });

      stepLogs.push({
        name: "Send Slack Notification",
        status: "success",
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      stepLogs.push({
        name: "Send Slack Notification",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
      // Don't throw - Slack notification is not critical
    }

    // Update execution log
    const durationMs = Date.now() - startTime;
    if (logId) {
      await updateExecutionLog(logId, {
        status: "success",
        outputPayload: {
          email,
          firstName,
          lastName,
          klaviyoSynced: true,
          listSubscribed: !!KLAVIYO_LIST_ID,
        },
        stepLogs,
        completedAt: new Date(),
        durationMs,
      });
      if (workflow) await incrementExecutionStats(workflow.id, true);
    }

    console.log(`Lead synced to Klaviyo: ${email} (${durationMs}ms)`);

    return NextResponse.json({
      success: true,
      email,
      klaviyoSynced: true,
      listSubscribed: !!KLAVIYO_LIST_ID,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Lead sync error:", error);

    // Update execution log
    if (logId) {
      await updateExecutionLog(logId, {
        status: "failed",
        errorMessage,
        stepLogs,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      });
      if (workflow) await incrementExecutionStats(workflow.id, false);
    }

    // Send error notification to Slack
    await sendSlackNotification({
      text: `⚠️ Lead-Sync Fehler: ${errorMessage}`,
    });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    handler: "lead-sync",
    listConfigured: !!KLAVIYO_LIST_ID,
    timestamp: new Date().toISOString(),
  });
}
