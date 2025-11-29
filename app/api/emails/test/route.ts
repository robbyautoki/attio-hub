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

// Deutsche GmbH-konforme Email-Signatur mit Foto
const signatureHtml = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; max-width: 500px;">
  <tr>
    <td style="border-top: 2px solid #e5e5e5; padding-top: 20px;"></td>
  </tr>
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: top; padding-right: 20px;">
            <img src="https://attio-hub.vercel.app/signature-photo.jpg" alt="Robby Reinemann" width="90" height="90" style="border-radius: 50%; display: block;" />
          </td>
          <td style="vertical-align: top;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 18px; font-weight: 600; color: #000000; line-height: 1.3; padding-bottom: 2px;">
                  Robby Reinemann
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #666666; line-height: 1.4; padding-bottom: 12px;">
                  Geschäftsführer
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #333333; line-height: 1.6;">
                  <a href="mailto:robby@avanto-vr.de" style="color: #333333; text-decoration: none;">robby@avanto-vr.de</a>
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #333333; line-height: 1.6;">
                  <a href="tel:+49421XXXXXXX" style="color: #333333; text-decoration: none;">+49 421 XXX XXXX</a>
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; line-height: 1.6;">
                  <a href="https://avanto-vr.de" style="color: #000000; text-decoration: none; font-weight: 500;">avanto-vr.de</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 16px; border-top: 1px solid #e5e5e5; margin-top: 16px;"></td>
  </tr>
  <tr>
    <td style="padding-top: 12px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size: 12px; font-weight: 600; color: #000000; line-height: 1.4;">
            AVANTO VR Solutions GmbH
          </td>
        </tr>
        <tr>
          <td style="font-size: 11px; color: #666666; line-height: 1.5; padding-top: 4px;">
            Otto-Lilienthal-Str. 20 · 28199 Bremen
          </td>
        </tr>
        <tr>
          <td style="font-size: 10px; color: #999999; line-height: 1.5; padding-top: 8px;">
            Amtsgericht Bremen · HRB XXXXX · USt-IdNr.: DE XXXXXXXXX
          </td>
        </tr>
        <tr>
          <td style="font-size: 10px; color: #999999; line-height: 1.5;">
            Geschäftsführer: Robby Reinemann
          </td>
        </tr>
      </table>
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
      from: "autoki <robby@notifications.auto.ki>",
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
