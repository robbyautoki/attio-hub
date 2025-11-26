import { NextResponse } from "next/server";
import { markBookingAsNoShow, getBookingByEmail } from "@/lib/services/booking.service";
import { sendSlackNotification } from "@/lib/integrations/slack";
import { createResendClient } from "@/lib/integrations/resend";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";
import { getWorkflowByWebhookPath, incrementExecutionStats } from "@/lib/services/workflow.service";
import { createExecutionLog, updateExecutionLog } from "@/lib/services/execution.service";
import {
  sendThankYouDiscoveryEmail as sendGmailThankYouDiscovery,
  sendThankYouStrategieEmail as sendGmailThankYouStrategie,
  isGmailConfigured,
} from "@/lib/integrations/gmail";

// Attio Webhook Handler for booking status changes
// Handles: "No-Show", "Meeting läuft - Person fehlt", and "Termin abgeschlossen"

// Status values from Attio
const STATUS_NO_SHOW = "No-Show";
const STATUS_MEETING_RUNNING = "Meeting läuft - Person fehlt";
const STATUS_COMPLETED = "Termin abgeschlossen";

interface StepLog {
  name: string;
  status: "success" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: string;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const stepLogs: StepLog[] = [];
  let logId: string | null = null;
  let workflow: Awaited<ReturnType<typeof getWorkflowByWebhookPath>> = null;

  try {
    const payload = await request.json();

    console.log("Attio webhook received:", JSON.stringify(payload, null, 2));

    // Get the workflow for this webhook
    workflow = await getWorkflowByWebhookPath("attio");

    // Create execution log if workflow exists
    if (workflow) {
      const log = await createExecutionLog(workflow.id, "webhook", payload);
      logId = log.id;
      await updateExecutionLog(logId, { status: "running" });
    }

    // Step 1: Parse Attio Payload
    const stepStartParse = Date.now();
    let email: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let bookingStatus: string | undefined;
    let meetingType: string | undefined;

    // Format 1: Nested event structure (standard Attio webhook)
    if (payload.event) {
      const record = payload.event.record;
      email = record?.values?.email_addresses?.[0]?.email_address;
      firstName = record?.values?.name?.[0]?.first_name;
      lastName = record?.values?.name?.[0]?.last_name;
      // Try to get booking_status from the record or from new_value
      bookingStatus = record?.values?.booking_status?.[0]?.option?.title ||
                      payload.event?.new_value?.[0]?.option?.title;
      // Get meeting_type from record
      meetingType = record?.values?.meeting_type?.[0]?.option?.title ||
                    record?.values?.meeting_type?.[0]?.value ||
                    record?.values?.meeting_type;
    }

    // Format 2: Flat structure (direct fields)
    if (!email && payload.email) {
      email = payload.email;
    }
    if (!firstName && payload.first_name) {
      firstName = payload.first_name;
    }
    if (!bookingStatus && payload.booking_status) {
      bookingStatus = payload.booking_status;
    }
    if (!meetingType && payload.meeting_type) {
      meetingType = payload.meeting_type;
    }

    // Format 3: Data wrapper
    if (!email && payload.data?.email) {
      email = payload.data.email;
      firstName = payload.data.first_name || payload.data.firstName;
      bookingStatus = payload.data.booking_status;
      meetingType = payload.data.meeting_type;
    }

    // Format 4: new_value at root level
    if (!bookingStatus && payload.new_value?.[0]?.option?.title) {
      bookingStatus = payload.new_value[0].option.title;
    }

    const fullName = firstName
      ? `${firstName}${lastName ? ` ${lastName}` : ""}`
      : "Unbekannt";

    stepLogs.push({
      name: "Parse Attio Payload",
      status: "success",
      input: payload,
      output: { email, firstName, lastName, bookingStatus, meetingType, fullName },
      durationMs: Date.now() - stepStartParse,
      timestamp: new Date().toISOString(),
    });

    // Log what we extracted
    console.log("Extracted data:", { email, firstName, lastName, bookingStatus, meetingType });

    // If we don't have email, we can't process further
    if (!email) {
      stepLogs.push({
        name: "Validate Email",
        status: "failed",
        error: "No email found in payload",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });

      await sendSlackNotification({
        text: `⚠️ Attio Webhook: Keine Email gefunden`,
      });

      // Update execution log as failed
      if (logId && workflow) {
        const durationMs = Date.now() - startTime;
        await updateExecutionLog(logId, {
          status: "failed",
          errorMessage: "No email in payload",
          stepLogs,
          completedAt: new Date(),
          durationMs,
        });
        await incrementExecutionStats(workflow.id, false);
      }

      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    console.log(`Processing for: ${fullName} (${email}) - Status: ${bookingStatus || "unknown"}`);

    // Step 2: Get booking from DB
    const stepStartBooking = Date.now();
    const booking = await getBookingByEmail(email);
    stepLogs.push({
      name: "Lookup Booking",
      status: booking ? "success" : "skipped",
      input: { email },
      output: booking ? { bookingId: booking.id, userId: booking.userId } : null,
      error: booking ? undefined : "No booking found for this email",
      durationMs: Date.now() - stepStartBooking,
      timestamp: new Date().toISOString(),
    });

    let emailSent = false;
    let action = "none";

    // Handle different status values
    if (bookingStatus === STATUS_NO_SHOW) {
      action = "no_show";

      // Step 3a: Update booking status in DB
      if (booking) {
        const stepStartUpdate = Date.now();
        try {
          await markBookingAsNoShow(booking.id);
          console.log(`Marked booking ${booking.id} as no_show`);
          stepLogs.push({
            name: "Mark Booking as No-Show",
            status: "success",
            input: { bookingId: booking.id },
            output: { status: "no_show" },
            durationMs: Date.now() - stepStartUpdate,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          stepLogs.push({
            name: "Mark Booking as No-Show",
            status: "failed",
            input: { bookingId: booking.id },
            error: error instanceof Error ? error.message : "Unknown error",
            durationMs: Date.now() - stepStartUpdate,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Step 3b: Send Slack notification
      const stepStartSlack = Date.now();
      try {
        await sendSlackNotification({
          text: `🚫 ${fullName} wurde als No-Show markiert (${email})`,
        });
        stepLogs.push({
          name: "Send Slack Notification",
          status: "success",
          output: { message: `No-Show: ${fullName}` },
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
      }

      // Step 3c: Send No-Show email
      if (booking) {
        const stepStartEmail = Date.now();
        emailSent = await sendNoShowEmail(booking, email, firstName);
        stepLogs.push({
          name: "Send No-Show Email",
          status: emailSent ? "success" : "failed",
          input: { to: email, firstName },
          error: emailSent ? undefined : "Failed to send email",
          durationMs: Date.now() - stepStartEmail,
          timestamp: new Date().toISOString(),
        });
      } else {
        stepLogs.push({
          name: "Send No-Show Email",
          status: "skipped",
          error: "No booking found - cannot send email",
          durationMs: 0,
          timestamp: new Date().toISOString(),
        });
      }

    } else if (bookingStatus === STATUS_MEETING_RUNNING) {
      action = "meeting_running";

      // Step 3a: Send Slack notification
      const stepStartSlack = Date.now();
      try {
        await sendSlackNotification({
          text: `⏰ Meeting mit ${fullName} läuft - Person fehlt (${email})`,
        });
        stepLogs.push({
          name: "Send Slack Notification",
          status: "success",
          output: { message: `Meeting running: ${fullName}` },
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
      }

      // Step 3b: Send "Meeting Running" email with join link
      if (booking) {
        const stepStartEmail = Date.now();
        emailSent = await sendMeetingRunningEmail(booking, email, firstName);
        stepLogs.push({
          name: "Send Meeting Running Email",
          status: emailSent ? "success" : "failed",
          input: { to: email, firstName, meetingLink: booking.meetingLink },
          error: emailSent ? undefined : "Failed to send email",
          durationMs: Date.now() - stepStartEmail,
          timestamp: new Date().toISOString(),
        });
      } else {
        stepLogs.push({
          name: "Send Meeting Running Email",
          status: "skipped",
          error: "No booking found - cannot send email",
          durationMs: 0,
          timestamp: new Date().toISOString(),
        });
      }

    } else if (bookingStatus === STATUS_COMPLETED) {
      action = "completed";

      // Step 3a: Send Slack notification
      const stepStartSlack = Date.now();
      try {
        await sendSlackNotification({
          text: `✅ Termin mit ${fullName} abgeschlossen (${email}) - ${meetingType || "Unbekannt"}`,
        });
        stepLogs.push({
          name: "Send Slack Notification",
          status: "success",
          output: { message: `Completed: ${fullName}`, meetingType },
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
      }

      // Step 3b: Send Thank You email based on meeting_type
      const stepStartEmail = Date.now();
      if (meetingType === "Discovery Call") {
        emailSent = await sendThankYouDiscoveryEmail(booking, email, firstName);
        stepLogs.push({
          name: "Send Thank You Discovery Email",
          status: emailSent ? "success" : "failed",
          input: { to: email, firstName, meetingType },
          error: emailSent ? undefined : "Failed to send email",
          durationMs: Date.now() - stepStartEmail,
          timestamp: new Date().toISOString(),
        });
      } else if (meetingType === "Strategie Call") {
        emailSent = await sendThankYouStrategieEmail(booking, email, firstName);
        stepLogs.push({
          name: "Send Thank You Strategie Email",
          status: emailSent ? "success" : "failed",
          input: { to: email, firstName, meetingType },
          error: emailSent ? undefined : "Failed to send email",
          durationMs: Date.now() - stepStartEmail,
          timestamp: new Date().toISOString(),
        });
      } else {
        stepLogs.push({
          name: "Send Thank You Email",
          status: "skipped",
          error: `Unknown meeting_type: ${meetingType || "not provided"}`,
          durationMs: Date.now() - stepStartEmail,
          timestamp: new Date().toISOString(),
        });
      }

    } else {
      // Unknown or unhandled status - just log it
      console.log(`Unhandled booking status: ${bookingStatus}`);
      const stepStartSlack = Date.now();
      await sendSlackNotification({
        text: `ℹ️ Attio Status-Änderung: ${fullName} (${email}) → ${bookingStatus || "unbekannt"}`,
      });
      stepLogs.push({
        name: "Log Unknown Status",
        status: "success",
        output: { status: bookingStatus || "unbekannt" },
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if any critical step failed
    const hasCriticalFailure = stepLogs.some(
      (s) => s.status === "failed" && (s.name.includes("Email") || s.name.includes("Booking"))
    );

    // Update execution log with success/partial success
    const durationMs = Date.now() - startTime;
    const finalStatus = hasCriticalFailure ? "failed" : "success";

    if (logId && workflow) {
      await updateExecutionLog(logId, {
        status: finalStatus,
        outputPayload: { email, fullName, bookingStatus, action, bookingFound: !!booking, emailSent },
        stepLogs,
        completedAt: new Date(),
        durationMs,
      });
      await incrementExecutionStats(workflow.id, !hasCriticalFailure);
      // Detailed logs are saved to DB and shown in frontend - no verbose Slack summary needed
    }

    return NextResponse.json({
      success: true,
      processed: {
        email,
        name: fullName,
        status: bookingStatus,
        action,
        bookingFound: !!booking,
        emailSent,
      },
    });
  } catch (error) {
    console.error("Attio webhook error:", error);
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
      // Detailed error logs are saved to DB and shown in frontend
    }

    // Send compact error to Slack
    await sendSlackNotification({
      text: `❌ Attio Webhook Fehler: ${errorMessage}`,
    });

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Helper function to send No-Show email
async function sendNoShowEmail(
  booking: { userId: string; firstName: string | null; startTime: Date; eventType: string | null },
  email: string,
  firstName: string | undefined
): Promise<boolean> {
  try {
    const resendKey = await getDecryptedApiKeyByService(booking.userId, "resend");
    if (!resendKey) {
      console.log("No Resend API key found for user");
      return false;
    }

    const resendClient = createResendClient(resendKey);
    const startDate = new Date(booking.startTime);

    const datum = startDate.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const uhrzeit = startDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await resendClient.sendNoShowEmail({
      to: email,
      variables: {
        vorname: booking.firstName || firstName || "dort",
        terminart: booking.eventType || "Discovery Call",
        datum,
        uhrzeit,
      },
    });

    console.log(`No-Show email sent to ${email}`);
    return true;
  } catch (emailError) {
    console.error("Failed to send No-Show email:", emailError);
    await sendSlackNotification({
      text: `⚠️ No-Show Email konnte nicht gesendet werden: ${emailError instanceof Error ? emailError.message : "Unknown error"}`,
    });
    return false;
  }
}

// Helper function to send Meeting Running email
async function sendMeetingRunningEmail(
  booking: { userId: string; firstName: string | null; startTime: Date; eventType: string | null; meetingLink: string | null },
  email: string,
  firstName: string | undefined
): Promise<boolean> {
  try {
    const resendKey = await getDecryptedApiKeyByService(booking.userId, "resend");
    if (!resendKey) {
      console.log("No Resend API key found for user");
      return false;
    }

    const resendClient = createResendClient(resendKey);
    const startDate = new Date(booking.startTime);

    const uhrzeit = startDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await resendClient.sendMeetingRunningEmail({
      to: email,
      variables: {
        vorname: booking.firstName || firstName || "dort",
        terminart: booking.eventType || "Discovery Call",
        uhrzeit,
        meetingLink: booking.meetingLink || "https://cal.com/auto-ki/discovery",
      },
    });

    console.log(`Meeting Running email sent to ${email}`);
    return true;
  } catch (emailError) {
    console.error("Failed to send Meeting Running email:", emailError);
    await sendSlackNotification({
      text: `⚠️ Meeting-Reminder Email konnte nicht gesendet werden: ${emailError instanceof Error ? emailError.message : "Unknown error"}`,
    });
    return false;
  }
}

// Helper function to send Thank You Discovery email
async function sendThankYouDiscoveryEmail(
  booking: { userId: string; firstName: string | null } | null,
  email: string,
  firstName: string | undefined
): Promise<boolean> {
  try {
    const vorname = booking?.firstName || firstName || "dort";

    // Try Gmail first if configured (emails from matthias@auto.ki)
    if (isGmailConfigured()) {
      try {
        await sendGmailThankYouDiscovery({ to: email, vorname });
        console.log(`Thank You Discovery email sent via Gmail to ${email}`);
        return true;
      } catch (gmailError) {
        console.error("Gmail failed, falling back to Resend:", gmailError);
      }
    }

    // Fallback to Resend
    const userId = booking?.userId;
    if (!userId) {
      console.log("No booking found - cannot determine user for API key");
      return false;
    }

    const resendKey = await getDecryptedApiKeyByService(userId, "resend");
    if (!resendKey) {
      console.log("No Resend API key found for user");
      return false;
    }

    const resendClient = createResendClient(resendKey);

    await resendClient.sendThankYouDiscoveryEmail({
      to: email,
      variables: {
        vorname,
      },
    });

    console.log(`Thank You Discovery email sent via Resend to ${email}`);
    return true;
  } catch (emailError) {
    console.error("Failed to send Thank You Discovery email:", emailError);
    await sendSlackNotification({
      text: `⚠️ Thank You Discovery Email konnte nicht gesendet werden: ${emailError instanceof Error ? emailError.message : "Unknown error"}`,
    });
    return false;
  }
}

// Helper function to send Thank You Strategie email
async function sendThankYouStrategieEmail(
  booking: { userId: string; firstName: string | null } | null,
  email: string,
  firstName: string | undefined
): Promise<boolean> {
  try {
    const vorname = booking?.firstName || firstName || "dort";

    // Try Gmail first if configured (emails from matthias@auto.ki)
    if (isGmailConfigured()) {
      try {
        await sendGmailThankYouStrategie({ to: email, vorname });
        console.log(`Thank You Strategie email sent via Gmail to ${email}`);
        return true;
      } catch (gmailError) {
        console.error("Gmail failed, falling back to Resend:", gmailError);
      }
    }

    // Fallback to Resend
    const userId = booking?.userId;
    if (!userId) {
      console.log("No booking found - cannot determine user for API key");
      return false;
    }

    const resendKey = await getDecryptedApiKeyByService(userId, "resend");
    if (!resendKey) {
      console.log("No Resend API key found for user");
      return false;
    }

    const resendClient = createResendClient(resendKey);

    await resendClient.sendThankYouStrategieEmail({
      to: email,
      variables: {
        vorname,
      },
    });

    console.log(`Thank You Strategie email sent via Resend to ${email}`);
    return true;
  } catch (emailError) {
    console.error("Failed to send Thank You Strategie email:", emailError);
    await sendSlackNotification({
      text: `⚠️ Thank You Strategie Email konnte nicht gesendet werden: ${emailError instanceof Error ? emailError.message : "Unknown error"}`,
    });
    return false;
  }
}

// Attio sends a GET request to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: "ok", handler: "attio-webhook" });
}
