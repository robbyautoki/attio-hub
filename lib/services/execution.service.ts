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
import { sendSlackNotification, sendNewMeetingNotification } from "@/lib/integrations/slack";
import { createEmailLog, extractResendId } from "./email-log.service";

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
    let personRecordId: string | null = null;
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
        }) as { data?: { id?: { record_id?: string } } };

        // Extract person record ID for deal creation
        personRecordId = attioResult?.data?.id?.record_id || null;

        stepLogs.push({
          name: "Create/Update Attio Contact",
          status: "success",
          input: bookingData,
          output: attioResult,
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });

        // Create Deal linked to person (and company if available)
        if (personRecordId) {
          const stepStartDeal = Date.now();
          try {
            // Try to find company by email domain, or create if not found
            let companyRecordId: string | null = null;
            const emailDomain = bookingData.email.split("@")[1];
            if (emailDomain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "web.de", "gmx.de", "gmx.net"].includes(emailDomain.toLowerCase())) {
              try {
                // First try to find existing company
                const companyResult = await attioClient.findCompanyByDomain(emailDomain);
                companyRecordId = companyResult?.data?.[0]?.id?.record_id || null;

                // If not found, create company via upsert
                if (!companyRecordId) {
                  const companyName = emailDomain.split('.')[0].replace(/-/g, ' ');
                  const upsertResult = await attioClient.upsertCompany({
                    domain: emailDomain,
                    name: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                  }) as { data?: { id?: { record_id?: string } } };
                  companyRecordId = upsertResult?.data?.id?.record_id || null;
                }
              } catch {
                // Company lookup/creation failed, continue without
              }
            }

            // Stage IDs from Attio
            const NO_SHOW_STAGE_ID = "06a6e8aa-d398-400d-b27a-b3f76c7c7cda";
            const DISCOVERY_CALL_STAGE_ID = "0feb4f77-f994-4347-b058-c43f5b3c8070";

            // Check if person already has a deal
            const existingDeals = await attioClient.findDealsByPerson(personRecordId);
            const existingDeal = existingDeals?.data?.[0];

            if (existingDeal) {
              const dealId = existingDeal.id?.record_id;
              const currentStageId = existingDeal.values?.stage?.[0]?.status_id;
              const currentStageTitle = existingDeal.values?.stage?.[0]?.title;

              if (currentStageId === NO_SHOW_STAGE_ID && dealId) {
                // Reset stage from No Show to Discovery Call
                await attioClient.updateDealStage(dealId, DISCOVERY_CALL_STAGE_ID);
                stepLogs.push({
                  name: "Reset Deal Stage (No Show → Discovery Call)",
                  status: "success",
                  input: { dealId, previousStage: currentStageTitle },
                  output: { newStage: "Discovery Call" },
                  durationMs: Date.now() - stepStartDeal,
                  timestamp: new Date().toISOString(),
                });
              } else {
                // Deal exists in other stage - skip creation
                stepLogs.push({
                  name: "Create Attio Deal (Discovery Call)",
                  status: "skipped",
                  input: { personRecordId },
                  output: { reason: "Deal already exists", currentStage: currentStageTitle, dealId },
                  durationMs: Date.now() - stepStartDeal,
                  timestamp: new Date().toISOString(),
                });
              }
            } else {
              // No existing deal - create new one
              const dealName = bookingData.name || bookingData.email;
              const dealResult = await attioClient.createDeal({
                name: dealName,
                personRecordId,
                companyRecordId,
              });

              stepLogs.push({
                name: "Create Attio Deal (Discovery Call)",
                status: "success",
                input: { dealName, personRecordId, companyRecordId },
                output: dealResult,
                durationMs: Date.now() - stepStartDeal,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (dealError) {
            stepLogs.push({
              name: "Create Attio Deal (Discovery Call)",
              status: "failed",
              input: { personRecordId },
              error: dealError instanceof Error ? dealError.message : "Unknown error",
              durationMs: Date.now() - stepStartDeal,
              timestamp: new Date().toISOString(),
            });
          }
        }
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
            bookingData.firstName || undefined
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

        // Log the email (fire and forget - don't let logging failures break the workflow)
        try {
          await createEmailLog({
            emailType: "confirmation",
            to: bookingData.email,
            subject: "Dein Termin steht!",
            from: "Auto.ki <robby@notifications.auto.ki>",
            status: "sent",
            resendId: extractResendId(resendResult),
            userId: workflow.userId,
          });
        } catch (logError) {
          console.error("Failed to log email (non-critical):", logError);
        }

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
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Log failed email (fire and forget)
        try {
          await createEmailLog({
            emailType: "confirmation",
            to: bookingData.email!,
            subject: "Dein Termin steht!",
            from: "Auto.ki <robby@notifications.auto.ki>",
            status: "failed",
            errorMessage,
            userId: workflow.userId,
          });
        } catch (logError) {
          console.error("Failed to log email error (non-critical):", logError);
        }

        stepLogs.push({
          name: "Send Booking Confirmation Email (Resend)",
          status: "failed",
          input: {
            to: bookingData.email,
            vorname: bookingData.firstName,
          },
          error: errorMessage,
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

    // Send compact Slack notification to logs
    const emoji = finalStatus === "success" ? "✅" : "❌";
    await sendSlackNotification({
      text: `${emoji} ${workflow.name}: ${bookingData.firstName || "Unbekannt"} (${bookingData.email})`,
    });

    // Send new meeting notification to #new-meetings channel
    if (finalStatus === "success" && bookingData.email && bookingData.datum && bookingData.uhrzeit) {
      await sendNewMeetingNotification({
        name: bookingData.name || bookingData.firstName || "Unbekannt",
        email: bookingData.email,
        datum: bookingData.datum,
        uhrzeit: bookingData.uhrzeit,
        eventType: bookingData.eventType || "Discovery Call",
        meetingLink: bookingData.meetingLink,
      });
    }
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

    // Send compact Slack error notification
    await sendSlackNotification({
      text: `❌ ${workflow.name} Fehler: ${errorMessage}`,
    });

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
    // Format: "25. November 2025" (in German timezone)
    datum = startDate.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin",
    });
    // Format: "14:30" (in German timezone)
    uhrzeit = startDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
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
