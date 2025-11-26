import { NextResponse } from "next/server";
import { markBookingAsNoShow, getBookingByEmail } from "@/lib/services/booking.service";
import { sendSlackNotification } from "@/lib/integrations/slack";
import { createResendClient } from "@/lib/integrations/resend";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";

// Attio Webhook Handler for booking status changes
// Handles: "No-Show" and "Meeting läuft - Person fehlt"

// Status values from Attio
const STATUS_NO_SHOW = "No-Show";
const STATUS_MEETING_RUNNING = "Meeting läuft - Person fehlt";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log("Attio webhook received:", JSON.stringify(payload, null, 2));

    // Try multiple payload structures (Attio can send different formats)
    let email: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let bookingStatus: string | undefined;

    // Format 1: Nested event structure (standard Attio webhook)
    if (payload.event) {
      const record = payload.event.record;
      email = record?.values?.email_addresses?.[0]?.email_address;
      firstName = record?.values?.name?.[0]?.first_name;
      lastName = record?.values?.name?.[0]?.last_name;
      // Try to get booking_status from the record or from new_value
      bookingStatus = record?.values?.booking_status?.[0]?.option?.title ||
                      payload.event?.new_value?.[0]?.option?.title;
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

    // Format 3: Data wrapper
    if (!email && payload.data?.email) {
      email = payload.data.email;
      firstName = payload.data.first_name || payload.data.firstName;
      bookingStatus = payload.data.booking_status;
    }

    // Format 4: new_value at root level
    if (!bookingStatus && payload.new_value?.[0]?.option?.title) {
      bookingStatus = payload.new_value[0].option.title;
    }

    const fullName = firstName
      ? `${firstName}${lastName ? ` ${lastName}` : ""}`
      : "Unbekannt";

    // Log what we extracted
    console.log("Extracted data:", { email, firstName, lastName, bookingStatus });

    // If we don't have email, we can't process further
    if (!email) {
      await sendSlackNotification({
        text: `⚠️ Attio Webhook: Keine Email gefunden`,
      });
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    console.log(`Processing for: ${fullName} (${email}) - Status: ${bookingStatus || "unknown"}`);

    // Get booking from DB
    const booking = await getBookingByEmail(email);
    let emailSent = false;
    let action = "none";

    // Handle different status values
    if (bookingStatus === STATUS_NO_SHOW) {
      action = "no_show";

      // 1. Update booking status in DB
      if (booking) {
        await markBookingAsNoShow(booking.id);
        console.log(`Marked booking ${booking.id} as no_show`);
      }

      // 2. Send Slack notification
      await sendSlackNotification({
        text: `🚫 ${fullName} wurde als No-Show markiert (${email})`,
      });

      // 3. Send No-Show email
      if (booking) {
        emailSent = await sendNoShowEmail(booking, email, firstName);
      }

    } else if (bookingStatus === STATUS_MEETING_RUNNING) {
      action = "meeting_running";

      // 1. Send Slack notification
      await sendSlackNotification({
        text: `⏰ Meeting mit ${fullName} läuft - Person fehlt (${email})`,
      });

      // 2. Send "Meeting Running" email with join link
      if (booking) {
        emailSent = await sendMeetingRunningEmail(booking, email, firstName);
      }

    } else {
      // Unknown or unhandled status - just log it
      console.log(`Unhandled booking status: ${bookingStatus}`);
      await sendSlackNotification({
        text: `ℹ️ Attio Status-Änderung: ${fullName} (${email}) → ${bookingStatus || "unbekannt"}`,
      });
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

    // Send compact error to Slack
    await sendSlackNotification({
      text: `❌ Attio Webhook Fehler: ${error instanceof Error ? error.message : "Unknown error"}`,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
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

// Attio sends a GET request to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: "ok", handler: "attio-webhook" });
}
