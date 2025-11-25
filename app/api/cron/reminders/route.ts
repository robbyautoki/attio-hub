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

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// It checks for upcoming bookings and sends reminder emails

export async function GET(request: Request) {
  // Verify cron secret (optional but recommended for security)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    reminder24h: { sent: 0, failed: 0, skipped: 0 },
    reminder1h: { sent: 0, failed: 0, skipped: 0 },
    errors: [] as string[],
  };

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

        // Send 1h reminder email
        // TODO: Replace with actual template when user provides it
        await resendClient.sendEmail({
          from: "Auto.ki <robby@notifications.auto.ki>",
          to: booking.email,
          subject: "Dein Termin startet gleich!",
          html: build1hReminderHtml({
            vorname: booking.firstName || "dort",
            uhrzeit,
            meetingLink: booking.meetingLink || "",
          }),
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

    if (totalSent > 0 || totalFailed > 0) {
      await sendSlackNotification({
        text: `Reminder Cron: ${totalSent} gesendet, ${totalFailed} fehlgeschlagen`,
        blocks: [
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
          {
            type: "divider",
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Build HTML for 1h reminder email
 * TODO: Replace with actual Resend template when provided
 */
function build1hReminderHtml(vars: {
  vorname: string;
  uhrzeit: string;
  meetingLink: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 24px; margin-bottom: 20px;">Dein Termin startet gleich! 🚀</h1>

  <p>Hey ${vars.vorname},</p>

  <p>Dein Termin startet in einer Stunde um ${vars.uhrzeit} Uhr.</p>

  ${vars.meetingLink ? `
  <p>Klicke hier um dem Meeting beizutreten:</p>
  <a href="${vars.meetingLink}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zum Meeting</a>
  ` : ""}

  <p>Wir freuen uns auf dich!</p>

  <p>Liebe Grüße</p>
</body>
</html>
  `.trim();
}
