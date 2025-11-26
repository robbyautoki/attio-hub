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
  try {
    const payload = await request.json();

    console.log("Attio webhook received:", JSON.stringify(payload, null, 2));

    // Only react to attribute value updates
    if (payload.event?.event_type !== "record.attribute-value.updated") {
      return NextResponse.json({ ignored: true, reason: "not_attribute_update" });
    }

    // Only react to booking_status changes
    const attributeSlug = payload.event?.attribute?.slug;
    if (attributeSlug !== ATTIO_ATTRIBUTE_SLUG) {
      return NextResponse.json({ ignored: true, reason: "wrong_attribute" });
    }

    // Only react to "No-Show" status
    const newValue = payload.event?.new_value;
    const newStatus = newValue?.[0]?.option?.title || newValue?.[0]?.status?.title;

    if (newStatus !== NO_SHOW_STATUS) {
      return NextResponse.json({ ignored: true, reason: "not_no_show", newStatus });
    }

    // Extract email and name from the record
    const record = payload.event?.record;
    const emailAddresses = record?.values?.email_addresses;
    const email = emailAddresses?.[0]?.email_address;

    const nameValues = record?.values?.name;
    const firstName = nameValues?.[0]?.first_name || "dort";
    const lastName = nameValues?.[0]?.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();

    if (!email) {
      console.error("No email found in Attio webhook payload");
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    console.log(`Processing No-Show for: ${fullName} (${email})`);

    // 1. Update booking status in DB (if exists)
    const booking = await getBookingByEmail(email);
    if (booking) {
      await markBookingAsNoShow(booking.id);
      console.log(`Marked booking ${booking.id} as no_show`);
    }

    // 2. Send Slack notification
    await sendSlackNotification({
      text: `No-Show: ${fullName} (${email})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚫 No-Show gemeldet",
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
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Quelle: Attio Webhook | Status in Attio auf 'No-Show' geändert",
            },
          ],
        },
      ],
    });

    // 3. Send No-Show email (TODO: Add when template is provided)
    // const resendKey = await getDecryptedApiKeyByService(booking?.userId || "", "resend");
    // if (resendKey) {
    //   const resendClient = createResendClient(resendKey);
    //   await resendClient.sendNoShowEmail({
    //     to: email,
    //     variables: { vorname: firstName },
    //   });
    // }

    return NextResponse.json({
      success: true,
      processed: {
        email,
        name: fullName,
        bookingUpdated: !!booking,
      },
    });
  } catch (error) {
    console.error("Attio webhook error:", error);
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
