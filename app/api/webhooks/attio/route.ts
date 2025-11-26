import { NextResponse } from "next/server";
import { markBookingAsNoShow, getBookingByEmail } from "@/lib/services/booking.service";
import { sendSlackNotification } from "@/lib/integrations/slack";
import { createResendClient } from "@/lib/integrations/resend";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";

// Attio Webhook Handler for No-Show tracking
// Triggered when booking_status attribute is changed to "No-Show" in Attio

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log("Attio webhook received:", JSON.stringify(payload, null, 2));

    // Try multiple payload structures (Attio can send different formats)
    let email: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;

    // Format 1: Nested event structure (standard Attio webhook)
    if (payload.event) {
      const record = payload.event.record;
      email = record?.values?.email_addresses?.[0]?.email_address;
      firstName = record?.values?.name?.[0]?.first_name;
      lastName = record?.values?.name?.[0]?.last_name;
    }

    // Format 2: Flat structure (direct fields)
    if (!email && payload.email) {
      email = payload.email;
    }
    if (!firstName && payload.first_name) {
      firstName = payload.first_name;
    }

    // Format 3: Data wrapper
    if (!email && payload.data?.email) {
      email = payload.data.email;
      firstName = payload.data.first_name || payload.data.firstName;
    }

    const fullName = firstName
      ? `${firstName}${lastName ? ` ${lastName}` : ""}`
      : "Unbekannt";

    // Log what we extracted
    console.log("Extracted data:", { email, firstName, lastName });

    // If we don't have email, we can't process further
    if (!email) {
      await sendSlackNotification({
        text: `⚠️ Attio Webhook: Keine Email gefunden`,
      });
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    console.log(`Processing for: ${fullName} (${email})`);

    // 1. Update booking status in DB (if exists)
    const booking = await getBookingByEmail(email);
    if (booking) {
      await markBookingAsNoShow(booking.id);
      console.log(`Marked booking ${booking.id} as no_show`);
    }

    // 2. Send compact Slack notification
    await sendSlackNotification({
      text: `🚫 ${fullName} wurde als No-Show markiert (${email})`,
    });

    // 3. Send No-Show email if booking exists (uses booking data for template variables)
    let emailSent = false;
    if (booking) {
      try {
        const resendKey = await getDecryptedApiKeyByService(booking.userId, "resend");
        if (resendKey) {
          const resendClient = createResendClient(resendKey);

          // Format date and time from booking
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

          emailSent = true;
          console.log(`No-Show email sent to ${email}`);
        } else {
          console.log("No Resend API key found for user");
        }
      } catch (emailError) {
        console.error("Failed to send No-Show email:", emailError);
        await sendSlackNotification({
          text: `⚠️ No-Show Email konnte nicht gesendet werden: ${emailError instanceof Error ? emailError.message : "Unknown error"}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: {
        email,
        name: fullName,
        bookingUpdated: !!booking,
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

// Attio sends a GET request to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: "ok", handler: "attio-webhook" });
}
