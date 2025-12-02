import { NextResponse } from "next/server";
import {
  getBookingsNeedingReminder24h,
  getBookingsNeedingReminder1h,
  markReminder24hSent,
  markReminder1hSent,
} from "@/lib/services/booking.service";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";
import { createResendClient } from "@/lib/integrations/resend";
import { sendSlackNotification } from "@/lib/integrations/slack";
import {
  createExecutionLog,
  updateExecutionLog,
} from "@/lib/services/execution.service";

// Fixed workflow ID for the Reminder Cron
const REMINDER_CRON_WORKFLOW_ID = "reminder-cron-workflow";

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// It checks for upcoming bookings and sends reminder emails

export async function GET(request: Request) {
  // Verify cron secret (optional but recommended for security)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    reminder24h: { sent: 0, failed: 0, skipped: 0 },
    reminder1h: { sent: 0, failed: 0, skipped: 0 },
    errors: [] as string[],
  };

  // Create execution log
  const log = await createExecutionLog(
    REMINDER_CRON_WORKFLOW_ID,
    "cron",
    { timestamp: new Date().toISOString() }
  );

  try {
    // Process 24h reminders
    const bookings24h = await getBookingsNeedingReminder24h();
    console.log(`Found ${bookings24h.length} bookings needing 24h reminder`);

    for (const booking of bookings24h) {
      try {
        // Get user's Resend API key
        const resendKey = await getDecryptedApiKeyByService(booking.userId, "resend");
        if (!resendKey) {
          results.reminder24h.skipped++;
          continue;
        }

        const resendClient = createResendClient(resendKey);

        // Format date and time for email
        const startDate = new Date(booking.startTime);
        const datum = startDate.toLocaleDateString("de-DE", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const uhrzeit = startDate.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Send 24h reminder email using te-24h template
        await resendClient.sendReminderEmail({
          to: booking.email,
          templateSlug: "te-24h",
          variables: {
            vorname: booking.firstName || "dort",
            terminart: booking.eventType || "Discovery Call",
            datum,
            uhrzeit,
            ort_oder_link: booking.meetingLink || "Link wird noch gesendet",
          },
        });

        await markReminder24hSent(booking.id);
        results.reminder24h.sent++;
      } catch (error) {
        results.reminder24h.failed++;
        results.errors.push(
          `24h reminder for ${booking.email}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // Process 1h reminders
    const bookings1h = await getBookingsNeedingReminder1h();
    console.log(`Found ${bookings1h.length} bookings needing 1h reminder`);

    for (const booking of bookings1h) {
      try {
        // Get user's Resend API key
        const resendKey = await getDecryptedApiKeyByService(booking.userId, "resend");
        if (!resendKey) {
          results.reminder1h.skipped++;
          continue;
        }

        const resendClient = createResendClient(resendKey);

        // Format date and time for email
        const startDate = new Date(booking.startTime);
        const uhrzeit = startDate.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Send 1h reminder email using te-1h template
        await resendClient.send1hReminderEmail({
          to: booking.email,
          variables: {
            vorname: booking.firstName || "dort",
            terminart: booking.eventType || "Discovery Call",
            uhrzeit,
            ort_oder_link: booking.meetingLink || "Link wird noch gesendet",
          },
        });

        await markReminder1hSent(booking.id);
        results.reminder1h.sent++;
      } catch (error) {
        results.reminder1h.failed++;
        results.errors.push(
          `1h reminder for ${booking.email}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // Send summary to Slack
    const totalSent = results.reminder24h.sent + results.reminder1h.sent;
    const totalFailed = results.reminder24h.failed + results.reminder1h.failed;
    const durationMs = Date.now() - startTime;

    // Build Slack blocks
    const slackBlocks: unknown[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `:alarm_clock: Reminder Cron ausgeführt`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*24h Reminder:*\n${results.reminder24h.sent} gesendet, ${results.reminder24h.failed} fehlgeschlagen`,
          },
          {
            type: "mrkdwn",
            text: `*1h Reminder:*\n${results.reminder1h.sent} gesendet, ${results.reminder1h.failed} fehlgeschlagen`,
          },
        ],
      },
    ];

    // Add error details if any
    if (results.errors.length > 0) {
      slackBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Fehler:*\n${results.errors.map((e) => `• ${e}`).join("\n")}`,
        },
      });
    }

    slackBlocks.push({ type: "divider" });

    if (totalSent > 0 || totalFailed > 0) {
      await sendSlackNotification({
        text: `Reminder Cron: ${totalSent} gesendet, ${totalFailed} fehlgeschlagen`,
        blocks: slackBlocks,
      });
    }

    // Update execution log with results
    await updateExecutionLog(log.id, {
      status: totalFailed > 0 ? "failed" : "success",
      outputPayload: results,
      stepLogs: [
        {
          name: "24h Reminders",
          status: results.reminder24h.failed > 0 ? "failed" : "success",
          output: results.reminder24h,
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
        {
          name: "1h Reminders",
          status: results.reminder1h.failed > 0 ? "failed" : "success",
          output: results.reminder1h,
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
      ],
      completedAt: new Date(),
      durationMs,
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Cron error:", error);

    // Update log with error
    await updateExecutionLog(log.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
