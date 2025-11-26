import { NextResponse } from "next/server";
import { getWorkflowByWebhookPath, incrementExecutionStats } from "@/lib/services/workflow.service";
import { createExecutionLog, updateExecutionLog } from "@/lib/services/execution.service";
import { createAttioClient } from "@/lib/integrations/attio";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";

// Academy Slack Webhook URL from environment
const ACADEMY_SLACK_WEBHOOK = process.env.ACADEMY_SLACK_WEBHOOK_URL;

// Academy List ID in Attio (from the URL: /collection/cd17dadd-2553-4477-8620-fa56045d88a4)
const ACADEMY_LIST_ID = "cd17dadd-2553-4477-8620-fa56045d88a4";

interface StepLog {
  name: string;
  status: "success" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: string;
}

/**
 * Send notification to Academy Slack channel
 */
async function sendAcademySlackNotification(text: string): Promise<void> {
  if (!ACADEMY_SLACK_WEBHOOK) {
    throw new Error("ACADEMY_SLACK_WEBHOOK_URL not configured");
  }

  const response = await fetch(ACADEMY_SLACK_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.status}`);
  }
}

/**
 * Format Academy event for Slack
 */
function formatAcademyEvent(payload: Record<string, unknown>): string {
  const eventType = payload.event || payload.type || payload.eventType || "unknown";
  const user = payload.user || payload.member || payload.student;
  const course = payload.course || payload.product || payload.item;

  // Extract user info
  let userName = "Unbekannt";
  let userEmail = "";
  if (typeof user === "object" && user !== null) {
    const u = user as Record<string, unknown>;
    userName = (u.name || u.full_name || u.firstName || "Unbekannt") as string;
    userEmail = (u.email || "") as string;
  } else if (typeof user === "string") {
    userName = user;
  }

  // Extract course info
  let courseName = "";
  if (typeof course === "object" && course !== null) {
    const c = course as Record<string, unknown>;
    courseName = (c.name || c.title || "") as string;
  } else if (typeof course === "string") {
    courseName = course;
  }

  // Format based on event type
  const eventStr = String(eventType).toLowerCase();

  if (eventStr.includes("signup") || eventStr.includes("register") || eventStr.includes("created")) {
    return `🎉 Neuer Academy-User: ${userName}${userEmail ? ` (${userEmail})` : ""}`;
  }

  if (eventStr.includes("enroll") || eventStr.includes("purchase") || eventStr.includes("bought")) {
    return `📚 Kurs-Anmeldung: ${userName} → ${courseName || "Unbekannter Kurs"}`;
  }

  if (eventStr.includes("complete") || eventStr.includes("finished") || eventStr.includes("graduated")) {
    return `🏆 Kurs abgeschlossen: ${userName} hat "${courseName || "Kurs"}" beendet!`;
  }

  if (eventStr.includes("lesson") || eventStr.includes("progress")) {
    return `📖 Fortschritt: ${userName} - ${courseName || "Lektion abgeschlossen"}`;
  }

  if (eventStr.includes("login") || eventStr.includes("session")) {
    return `👋 Login: ${userName}`;
  }

  if (eventStr.includes("cancel") || eventStr.includes("refund")) {
    return `⚠️ Stornierung: ${userName}${courseName ? ` - ${courseName}` : ""}`;
  }

  // Default format
  return `📣 Academy Event: ${eventType}${userName !== "Unbekannt" ? ` - ${userName}` : ""}${courseName ? ` (${courseName})` : ""}`;
}

/**
 * Add a person to the Academy list in Attio
 * Uses the Attio Lists API to add entries
 * @param recordId - The record ID from the upsertPerson result
 */
async function addPersonToAcademyList(apiKey: string, recordId: string): Promise<void> {
  // Add person to the Academy list
  // Attio Lists API: POST /v2/lists/{list_id}/entries
  const response = await fetch(`https://api.attio.com/v2/lists/${ACADEMY_LIST_ID}/entries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        parent_record_id: recordId,
        parent_object: "people",
        entry_values: {},
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Ignore 409 conflict (already in list)
    if (response.status !== 409) {
      throw new Error(`Failed to add to Academy list: ${response.status} - ${errorText}`);
    }
    console.log("Person already in Academy list");
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const stepLogs: StepLog[] = [];
  let logId: string | null = null;
  let workflow: Awaited<ReturnType<typeof getWorkflowByWebhookPath>> = null;

  try {
    const payload = await request.json();

    console.log("Academy webhook received:", JSON.stringify(payload, null, 2));

    // Get the workflow for this webhook
    workflow = await getWorkflowByWebhookPath("academy");

    // Create execution log if workflow exists
    if (workflow) {
      const log = await createExecutionLog(workflow.id, "webhook", payload);
      logId = log.id;
      await updateExecutionLog(logId, { status: "running" });
    }

    // Step 1: Parse Academy Payload
    const stepStartParse = Date.now();
    stepLogs.push({
      name: "Parse Academy Payload",
      status: "success",
      input: payload,
      output: {
        eventType: payload.event || payload.type || "unknown",
        hasUser: !!payload.user || !!payload.member,
        hasCourse: !!payload.course || !!payload.product,
      },
      durationMs: Date.now() - stepStartParse,
      timestamp: new Date().toISOString(),
    });

    // Step 2: Format and send Slack notification
    const stepStartSlack = Date.now();
    try {
      const message = formatAcademyEvent(payload);
      await sendAcademySlackNotification(message);

      stepLogs.push({
        name: "Send Academy Slack Notification",
        status: "success",
        output: { message },
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      stepLogs.push({
        name: "Send Academy Slack Notification",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
    }

    // Step 3: Add user to Attio (only for registration events)
    const eventType = String(payload.event || payload.type || "").toLowerCase();
    const isRegistration = eventType.includes("registration") || eventType.includes("signup") || eventType.includes("created");

    if (isRegistration && payload.user) {
      const stepStartAttio = Date.now();
      try {
        // Get user data from payload
        const user = payload.user as Record<string, unknown>;
        const email = user.email as string;
        const fullName = (user.full_name || user.name || "") as string;

        // Split full name into first/last
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        if (email && workflow) {
          // Get Attio API key (using workflow owner's userId)
          const attioApiKey = await getDecryptedApiKeyByService(workflow.userId, "attio");

          if (attioApiKey) {
            const attioClient = createAttioClient(attioApiKey);

            // Create/update person in Attio
            const attioResult = await attioClient.upsertPerson({
              email,
              name: fullName || undefined,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
            }) as { data?: { id?: { record_id?: string } } };

            // Extract record_id from upsert result and add to Academy list
            const recordId = attioResult?.data?.id?.record_id;
            if (recordId) {
              await addPersonToAcademyList(attioApiKey, recordId);
            }

            stepLogs.push({
              name: "Add to Attio Academy List",
              status: "success",
              input: { email, fullName },
              output: attioResult,
              durationMs: Date.now() - stepStartAttio,
              timestamp: new Date().toISOString(),
            });
          } else {
            stepLogs.push({
              name: "Add to Attio Academy List",
              status: "skipped",
              error: "Attio API key not configured",
              durationMs: Date.now() - stepStartAttio,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          stepLogs.push({
            name: "Add to Attio Academy List",
            status: "skipped",
            error: "No email in payload",
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        stepLogs.push({
          name: "Add to Attio Academy List",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update execution log
    const durationMs = Date.now() - startTime;
    const hasCriticalFailure = stepLogs.some((s) => s.status === "failed");
    const finalStatus = hasCriticalFailure ? "failed" : "success";

    if (logId && workflow) {
      await updateExecutionLog(logId, {
        status: finalStatus,
        outputPayload: payload,
        stepLogs,
        completedAt: new Date(),
        durationMs,
      });
      await incrementExecutionStats(workflow.id, !hasCriticalFailure);
    }

    return NextResponse.json({
      success: true,
      message: "Academy webhook processed",
      durationMs,
    });
  } catch (error) {
    console.error("Academy webhook error:", error);
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update execution log as failed
    if (logId && workflow) {
      await updateExecutionLog(logId, {
        status: "failed",
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        stepLogs,
        completedAt: new Date(),
        durationMs,
      });
      await incrementExecutionStats(workflow.id, false);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET for testing
export async function GET() {
  return NextResponse.json({
    status: "ok",
    handler: "academy-webhook",
    webhookUrl: "https://attio-hub.vercel.app/api/webhooks/academy",
  });
}
