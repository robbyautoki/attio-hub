import { NextResponse } from "next/server";
import { getWorkflowByWebhookPath, incrementExecutionStats } from "@/lib/services/workflow.service";
import { createExecutionLog, updateExecutionLog } from "@/lib/services/execution.service";

// Academy Slack Webhook URL from environment
const ACADEMY_SLACK_WEBHOOK = process.env.ACADEMY_SLACK_WEBHOOK_URL;

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
