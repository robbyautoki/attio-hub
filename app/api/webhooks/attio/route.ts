import { NextResponse } from "next/server";
import { markBookingAsNoShow, getBookingByEmail } from "@/lib/services/booking.service";
import { sendSlackNotification } from "@/lib/integrations/slack";
// import { createResendClient } from "@/lib/integrations/resend";
// import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";

// Attio Webhook Handler for No-Show tracking
// Triggered when booking_status attribute is changed to "No-Show" in Attio

const ATTIO_ATTRIBUTE_SLUG = "booking_status";
const NO_SHOW_STATUS = "No-Show";

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const payload = await request.json();

    console.log("Attio webhook received:", JSON.stringify(payload, null, 2));

    // Send initial Slack notification that webhook was received (for debugging)
    await sendSlackNotification({
      text: "Attio Webhook empfangen",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📥 Attio Webhook empfangen",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`\`\`${JSON.stringify(payload, null, 2).substring(0, 2500)}\`\`\``,
          },
        },
      ],
    });

    // Try multiple payload structures (Attio can send different formats)
    let email: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let newStatus: string | undefined;
    let attributeSlug: string | undefined;

    // Format 1: Nested event structure (standard Attio webhook)
    if (payload.event) {
      attributeSlug = payload.event.attribute?.slug;
      const newValue = payload.event.new_value;
      newStatus = newValue?.[0]?.option?.title || newValue?.[0]?.status?.title;

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

    const fullName = `${firstName || "Unbekannt"} ${lastName || ""}`.trim();

    // Log what we extracted
    console.log("Extracted data:", { email, firstName, lastName, newStatus, attributeSlug });

    // If we don't have email, we can't process further
    if (!email) {
      const durationMs = Date.now() - startTime;
      await sendSlackNotification({
        text: "Attio Webhook: Keine Email gefunden",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⚠️ Attio Webhook: Keine Email",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Konnte keine Email-Adresse aus der Payload extrahieren.\nDauer: ${durationMs}ms`,
            },
          },
        ],
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

    const durationMs = Date.now() - startTime;

    // 2. Send success Slack notification
    await sendSlackNotification({
      text: `Attio Webhook verarbeitet: ${fullName} (${email})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "✅ Attio Webhook erfolgreich",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${fullName}`,
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${email}`,
            },
            {
              type: "mrkdwn",
              text: `*Status:*\n${newStatus || "N/A"}`,
            },
            {
              type: "mrkdwn",
              text: `*Attribut:*\n${attributeSlug || "N/A"}`,
            },
          ],
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Booking gefunden:*\n${booking ? "Ja" : "Nein"}`,
            },
            {
              type: "mrkdwn",
              text: `*Dauer:*\n${durationMs}ms`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Quelle: Attio Webhook | Attio No-Show Handler",
            },
          ],
        },
        {
          type: "divider",
        },
      ],
    });

    // 3. Send No-Show email (TODO: Add when template is provided)
    // const resendKey = await getDecryptedApiKeyByService(booking?.userId || "", "resend");
    // if (resendKey) {
    //   const resendClient = createResendClient(resendKey);
    //   await resendClient.sendNoShowEmail({
    //     to: email,
    //     variables: { vorname: firstName || "dort" },
    //   });
    // }

    return NextResponse.json({
      success: true,
      processed: {
        email,
        name: fullName,
        bookingUpdated: !!booking,
        durationMs,
      },
    });
  } catch (error) {
    console.error("Attio webhook error:", error);

    // Send error to Slack
    await sendSlackNotification({
      text: "Attio Webhook Fehler",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "❌ Attio Webhook Fehler",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`\`\`${error instanceof Error ? error.message : "Unknown error"}\`\`\``,
          },
        },
        {
          type: "divider",
        },
      ],
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
