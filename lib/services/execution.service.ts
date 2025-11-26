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
import { createBooking, markConfirmationSent } from "./booking.service";
import { createAttioClient } from "@/lib/integrations/attio";
import { createKlaviyoClient } from "@/lib/integrations/klaviyo";
import { createResendClient } from "@/lib/integrations/resend";
import { sendSlackNotification, formatExecutionLogForSlack } from "@/lib/integrations/slack";

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
          bookingStatus: "Termin gebucht",
          meetingType: "Discovery Call",
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

    // Execute Klaviyo step - upsert profile and add to booking list
    const KLAVIYO_BOOKING_LIST_ID = "W7cQgS";
    if (klaviyoKey && bookingData.email) {
      const stepStartKlaviyo = Date.now();
      try {
        const klaviyoClient = createKlaviyoClient(klaviyoKey);
        const klaviyoResult = await klaviyoClient.upsertProfile({
          email: bookingData.email,
          firstName: bookingData.firstName,
          lastName: bookingData.lastName,
          phone: bookingData.phone,
        });
        stepLogs.push({
          name: "Create/Update Klaviyo Profile",
          status: "success",
          input: bookingData,
          output: klaviyoResult,
          durationMs: Date.now() - stepStartKlaviyo,
          timestamp: new Date().toISOString(),
        });

        // Add to booking list
        const stepStartList = Date.now();
        try {
          const listResult = await klaviyoClient.subscribeToList(
            KLAVIYO_BOOKING_LIST_ID,
            bookingData.email,
            bookingData.firstName || undefined,
            bookingData.lastName || undefined
          );
          stepLogs.push({
            name: "Add to Klaviyo Booking List",
            status: "success",
            input: { listId: KLAVIYO_BOOKING_LIST_ID, email: bookingData.email },
            output: listResult,
            durationMs: Date.now() - stepStartList,
            timestamp: new Date().toISOString(),
          });
        } catch (listError) {
          stepLogs.push({
            name: "Add to Klaviyo Booking List",
            status: "failed",
            input: { listId: KLAVIYO_BOOKING_LIST_ID, email: bookingData.email },
            error: listError instanceof Error ? listError.message : "Unknown error",
            durationMs: Date.now() - stepStartList,
            timestamp: new Date().toISOString(),
          });
        }
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

    // Execute Resend step - Send confirmation email with 1 minute delay
    const resendKey = await getDecryptedApiKeyByService(workflow.userId, "resend");
    if (resendKey && bookingData.email && bookingData.firstName) {
      const stepStartResend = Date.now();
      try {
        const resendClient = createResendClient(resendKey);

        // Schedule email for 1 minute from now
        const scheduledAt = new Date(Date.now() + 60 * 1000); // 1 minute delay

        const resendResult = await resendClient.sendBookingConfirmation({
          to: bookingData.email,
          vorname: bookingData.firstName,
          datum: bookingData.datum || "TBD",
          uhrzeit: bookingData.uhrzeit || "TBD",
          meetingLink: bookingData.meetingLink || "Link wird noch gesendet",
          scheduledAt,
        });

        stepLogs.push({
          name: "Send Booking Confirmation Email (Resend)",
          status: "success",
          input: {
            to: bookingData.email,
            vorname: bookingData.firstName,
            datum: bookingData.datum,
            uhrzeit: bookingData.uhrzeit,
            meetingLink: bookingData.meetingLink,
            scheduledAt: scheduledAt.toISOString(),
          },
          output: resendResult,
          durationMs: Date.now() - stepStartResend,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        stepLogs.push({
          name: "Send Booking Confirmation Email (Resend)",
          status: "failed",
          input: {
            to: bookingData.email,
            vorname: bookingData.firstName,
          },
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartResend,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      stepLogs.push({
        name: "Send Booking Confirmation Email (Resend)",
        status: "skipped",
        error: !resendKey
          ? "No Resend API key configured"
          : !bookingData.email
            ? "No email in payload"
            : "No firstName in payload",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Store booking in database for reminder tracking
    if (bookingData.email && bookingData.startTimeRaw) {
      const stepStartBooking = Date.now();
      try {
        const booking = await createBooking({
          email: bookingData.email,
          firstName: bookingData.firstName,
          lastName: bookingData.lastName,
          phone: bookingData.phone,
          startTime: new Date(bookingData.startTimeRaw),
          endTime: bookingData.endTimeRaw ? new Date(bookingData.endTimeRaw) : null,
          meetingLink: bookingData.meetingLink,
          eventType: bookingData.eventType,
          calcomBookingId: bookingData.calcomBookingId,
          calcomEventUid: bookingData.calcomEventUid,
          userId: workflow.userId,
          workflowId: workflow.id,
        });

        // Mark confirmation as sent if Resend step was successful
        const resendStepSuccess = stepLogs.some(
          (s) => s.name.includes("Resend") && s.status === "success"
        );
        if (resendStepSuccess) {
          await markConfirmationSent(booking.id);
        }

        stepLogs.push({
          name: "Store Booking for Reminders",
          status: "success",
          input: {
            email: bookingData.email,
            startTime: bookingData.startTimeRaw,
            calcomBookingId: bookingData.calcomBookingId,
          },
          output: { bookingId: booking.id },
          durationMs: Date.now() - stepStartBooking,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        stepLogs.push({
          name: "Store Booking for Reminders",
          status: "failed",
          input: { email: bookingData.email, startTime: bookingData.startTimeRaw },
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartBooking,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      stepLogs.push({
        name: "Store Booking for Reminders",
        status: "skipped",
        error: !bookingData.email ? "No email in payload" : "No start time in payload",
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
    const finalStatus = hasCriticalFailure ? "failed" : "success";
    await updateExecutionLog(logId, {
      status: finalStatus,
      outputPayload: { bookingData, stepLogs },
      stepLogs,
      completedAt: new Date(),
      durationMs,
    });

    // Update workflow stats
    await incrementExecutionStats(workflow.id, !hasCriticalFailure);

    // Send Slack notification
    await sendSlackNotification(
      formatExecutionLogForSlack({
        workflowName: workflow.name,
        status: finalStatus,
        durationMs,
        triggerType: "webhook",
        stepLogs,
      })
    );
  } catch (error) {
    // Handle unexpected errors
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateExecutionLog(logId, {
      status: "failed",
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      stepLogs,
      completedAt: new Date(),
      durationMs,
    });

    await incrementExecutionStats(workflow.id, false);

    // Send Slack notification for errors
    await sendSlackNotification(
      formatExecutionLogForSlack({
        workflowName: workflow.name,
        status: "failed",
        durationMs,
        triggerType: "webhook",
        stepLogs,
        errorMessage,
      })
    );

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
  website: string | null;
  // Additional fields for email template
  datum: string | null;
  uhrzeit: string | null;
  meetingLink: string | null;
  // For booking storage
  startTimeRaw: string | null;
  endTimeRaw: string | null;
  calcomBookingId: string | null;
  calcomEventUid: string | null;
  eventType: string | null;
} {
  // Cal.com payload structure
  const payloadData = payload.payload as Record<string, unknown> | undefined;
  const attendeeList = payloadData?.attendees as Array<Record<string, unknown>> | undefined;
  const attendee = attendeeList?.[0];
  const responses = payloadData?.responses as Record<string, { value?: string }> | undefined;

  // Get firstName and lastName directly from attendee (Cal.com provides these)
  const firstName = (attendee?.firstName as string) || null;
  const lastName = (attendee?.lastName as string) || null;
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : (attendee?.name as string) || null;

  // Get phone from attendee.phoneNumber (not .phone)
  const phone = (attendee?.phoneNumber as string) || null;

  // Get website from responses
  const website = responses?.website?.value || null;

  // Parse booking date and time
  const startTimeRaw = (payloadData?.startTime as string) || null;
  const endTimeRaw = (payloadData?.endTime as string) || null;
  let datum: string | null = null;
  let uhrzeit: string | null = null;

  if (startTimeRaw) {
    const startDate = new Date(startTimeRaw);
    // Format: "25. November 2025"
    datum = startDate.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    // Format: "14:30"
    uhrzeit = startDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Get meeting link from metadata or videoCallData
  const metadata = payloadData?.metadata as Record<string, unknown> | undefined;
  const videoCallData = metadata?.videoCallUrl as string | undefined;
  const meetingUrl = payloadData?.meetingUrl as string | undefined;
  const meetingLink = videoCallData || meetingUrl || null;

  // Get Cal.com booking identifiers
  const calcomBookingId = (payloadData?.bookingId as number)?.toString() ||
                          (payloadData?.id as number)?.toString() || null;
  const calcomEventUid = (payloadData?.uid as string) || null;
  const eventType = (payloadData?.title as string) ||
                    (payloadData?.eventTitle as string) || "Discovery Call";

  return {
    email: (attendee?.email as string) || null,
    name: fullName,
    firstName,
    lastName,
    phone,
    website,
    datum,
    uhrzeit,
    meetingLink,
    startTimeRaw,
    endTimeRaw,
    calcomBookingId,
    calcomEventUid,
    eventType,
  };
}
