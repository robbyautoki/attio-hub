import { db } from "@/lib/db";
import {
  executionLogs,
  workflows,
  type ExecutionLog,
  type Workflow,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getDecryptedApiKeyByService } from "./api-key.service";
import { incrementExecutionStats } from "./workflow.service";
import { createAttioClient } from "@/lib/integrations/attio";
import { createKlaviyoClient } from "@/lib/integrations/klaviyo";

export type ExecutionStatus = "pending" | "running" | "success" | "failed";

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
 * Creates a new execution log
 */
export async function createExecutionLog(
  workflowId: string,
  triggerType: string,
  inputPayload: Record<string, unknown>
): Promise<ExecutionLog> {
  const id = crypto.randomUUID();
  const now = new Date();

  const [log] = await db
    .insert(executionLogs)
    .values({
      id,
      workflowId,
      status: "pending",
      triggerType,
      inputPayload,
      startedAt: now,
    })
    .returning();

  return log;
}

/**
 * Updates an execution log
 */
export async function updateExecutionLog(
  id: string,
  data: Partial<{
    status: ExecutionStatus;
    outputPayload: Record<string, unknown>;
    errorMessage: string;
    errorStack: string;
    stepLogs: StepLog[];
    completedAt: Date;
    durationMs: number;
  }>
): Promise<void> {
  await db.update(executionLogs).set(data).where(eq(executionLogs.id, id));
}

/**
 * Gets execution logs for a workflow
 */
export async function getExecutionLogsByWorkflow(
  workflowId: string,
  limit: number = 50
): Promise<ExecutionLog[]> {
  return db
    .select()
    .from(executionLogs)
    .where(eq(executionLogs.workflowId, workflowId))
    .orderBy(desc(executionLogs.startedAt))
    .limit(limit);
}

/**
 * Gets all execution logs (for global logs page)
 */
export async function getAllExecutionLogs(limit: number = 100): Promise<
  Array<ExecutionLog & { workflowName: string }>
> {
  const logs = await db
    .select({
      log: executionLogs,
      workflowName: workflows.name,
    })
    .from(executionLogs)
    .leftJoin(workflows, eq(executionLogs.workflowId, workflows.id))
    .orderBy(desc(executionLogs.startedAt))
    .limit(limit);

  return logs.map((row) => ({
    ...row.log,
    workflowName: row.workflowName || "Unbekannt",
  }));
}

/**
 * Execute a Cal.com → Attio + Klaviyo workflow
 */
export async function executeCalcomWorkflow(
  workflow: Workflow,
  payload: Record<string, unknown>,
  logId: string
): Promise<void> {
  const startTime = Date.now();
  const stepLogs: StepLog[] = [];

  try {
    // Update status to running
    await updateExecutionLog(logId, { status: "running" });

    // Extract data from Cal.com webhook payload
    const stepStartParse = Date.now();
    const bookingData = parseCalcomPayload(payload);
    stepLogs.push({
      name: "Parse Cal.com Payload",
      status: "success",
      input: payload,
      output: bookingData,
      durationMs: Date.now() - stepStartParse,
      timestamp: new Date().toISOString(),
    });

    // Get the workflow owner's API keys
    const attioKey = await getDecryptedApiKeyByService(workflow.userId, "attio");
    const klaviyoKey = await getDecryptedApiKeyByService(workflow.userId, "klaviyo");

    // Execute Attio step
    if (attioKey && bookingData.email) {
      const stepStartAttio = Date.now();
      try {
        const attioClient = createAttioClient(attioKey);
        const attioResult = await attioClient.upsertPerson({
          email: bookingData.email,
          name: bookingData.name,
          firstName: bookingData.firstName,
          lastName: bookingData.lastName,
          phone: bookingData.phone,
          customFields: {
            cal_booking_date: bookingData.bookingDate,
            cal_event_type: bookingData.eventType,
            cal_booking_status: bookingData.triggerEvent,
          },
        });
        stepLogs.push({
          name: "Create/Update Attio Contact",
          status: "success",
          input: bookingData,
          output: attioResult,
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        stepLogs.push({
          name: "Create/Update Attio Contact",
          status: "failed",
          input: bookingData,
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });
        // Continue with Klaviyo even if Attio fails
      }
    } else {
      stepLogs.push({
        name: "Create/Update Attio Contact",
        status: "skipped",
        error: attioKey ? "No email in payload" : "No Attio API key configured",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Execute Klaviyo step
    if (klaviyoKey && bookingData.email) {
      const stepStartKlaviyo = Date.now();
      try {
        const klaviyoClient = createKlaviyoClient(klaviyoKey);
        const klaviyoResult = await klaviyoClient.upsertProfile({
          email: bookingData.email,
          firstName: bookingData.firstName,
          lastName: bookingData.lastName,
          phone: bookingData.phone,
          properties: {
            cal_booking_date: bookingData.bookingDate,
            cal_event_type: bookingData.eventType,
            cal_booking_status: bookingData.triggerEvent,
          },
        });
        stepLogs.push({
          name: "Create/Update Klaviyo Profile",
          status: "success",
          input: bookingData,
          output: klaviyoResult,
          durationMs: Date.now() - stepStartKlaviyo,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        stepLogs.push({
          name: "Create/Update Klaviyo Profile",
          status: "failed",
          input: bookingData,
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartKlaviyo,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      stepLogs.push({
        name: "Create/Update Klaviyo Profile",
        status: "skipped",
        error: klaviyoKey ? "No email in payload" : "No Klaviyo API key configured",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if any critical step failed
    const hasCriticalFailure = stepLogs.some(
      (s) => s.status === "failed" && s.name.includes("Contact")
    );

    // Update log with success/partial success
    const durationMs = Date.now() - startTime;
    await updateExecutionLog(logId, {
      status: hasCriticalFailure ? "failed" : "success",
      outputPayload: { bookingData, stepLogs },
      stepLogs,
      completedAt: new Date(),
      durationMs,
    });

    // Update workflow stats
    await incrementExecutionStats(workflow.id, !hasCriticalFailure);
  } catch (error) {
    // Handle unexpected errors
    const durationMs = Date.now() - startTime;
    await updateExecutionLog(logId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      stepLogs,
      completedAt: new Date(),
      durationMs,
    });

    await incrementExecutionStats(workflow.id, false);
    throw error;
  }
}

/**
 * Parse Cal.com webhook payload
 */
function parseCalcomPayload(payload: Record<string, unknown>): {
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bookingDate: string | null;
  eventType: string | null;
  triggerEvent: string | null;
} {
  // Cal.com payload structure can vary
  const triggerEvent = payload.triggerEvent as string | undefined;

  // Try to find attendee info
  const attendees = payload.payload as Record<string, unknown> | undefined;
  const booking = attendees?.booking as Record<string, unknown> | undefined;
  const attendeeList = (attendees?.attendees || booking?.attendees) as Array<Record<string, unknown>> | undefined;
  const attendee = attendeeList?.[0];

  // Extract name parts
  const fullName = (attendee?.name as string) || (attendees?.name as string) || null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (fullName) {
    const parts = fullName.split(" ");
    firstName = parts[0] || null;
    lastName = parts.slice(1).join(" ") || null;
  }

  return {
    email: (attendee?.email as string) || (attendees?.email as string) || null,
    name: fullName,
    firstName,
    lastName,
    phone: (attendee?.phone as string) || (attendees?.phone as string) || null,
    bookingDate: (booking?.startTime as string) || (attendees?.startTime as string) || null,
    eventType: (booking?.title as string) || (attendees?.title as string) || (payload.title as string) || null,
    triggerEvent: triggerEvent || null,
  };
}
