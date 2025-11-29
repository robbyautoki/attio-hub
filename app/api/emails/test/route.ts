import { NextResponse } from "next/server";

// Lazy init for Resend
let resendInstance: import("resend").Resend | null = null;

async function getResend() {
  if (!resendInstance) {
    const { Resend } = await import("resend");
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Minimalistisches Email-Signatur Template
const signatureHtml = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; max-width: 400px;">
  <tr>
    <td style="border-top: 1px solid #e5e5e5; padding-top: 16px;"></td>
  </tr>
  <tr>
    <td style="font-size: 16px; font-weight: 600; color: #000000; line-height: 1.4;">
      Robby Reinemann
    </td>
  </tr>
  <tr>
    <td style="font-size: 13px; color: #666666; padding-top: 2px; line-height: 1.4;">
      Gründer &amp; CEO
    </td>
  </tr>
  <tr>
    <td style="padding-top: 12px;"></td>
  </tr>
  <tr>
    <td style="font-size: 13px; color: #666666; line-height: 1.6;">
      <a href="mailto:hello@autoki.de" style="color: #666666; text-decoration: none;">hello@autoki.de</a>
    </td>
  </tr>
  <tr>
    <td style="font-size: 13px; color: #666666; line-height: 1.6;">
      <a href="tel:+49XXX" style="color: #666666; text-decoration: none;">+49 XXX XXXXXXX</a>
    </td>
  </tr>
  <tr>
    <td style="font-size: 13px; line-height: 1.6;">
      <a href="https://autoki.de" style="color: #000000; text-decoration: none;">autoki.de</a>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 16px;"></td>
  </tr>
  <tr>
    <td style="font-size: 11px; color: #999999; line-height: 1.4;">
      autoki GmbH · Berlin
    </td>
  </tr>
</table>`;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email ist erforderlich" }, { status: 400 });
    }

    const resend = await getResend();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif;">
  <p style="font-size: 14px; color: #333333; line-height: 1.6; margin-bottom: 24px;">
    Hallo,<br><br>
    dies ist eine Test-Email mit der neuen Signatur.
  </p>
  ${signatureHtml}
</body>
</html>`;

    const result = await resend.emails.send({
      from: "autoki <hello@autoki.de>",
      to: email,
      subject: "Test: E-Mail Signatur",
      html: emailHtml,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Senden" },
      { status: 500 }
    );
  }
}
