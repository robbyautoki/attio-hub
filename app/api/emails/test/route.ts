import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Resend } from "resend";

// Lazy initialize Resend to avoid build-time errors
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY nicht konfiguriert");
  }
  return new Resend(apiKey);
}

// Apple-inspired minimalist email footer HTML
const emailFooterHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
  <tr>
    <td align="center" style="padding: 48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">

        <!-- Divider -->
        <tr>
          <td style="padding-bottom: 32px;">
            <div style="height: 1px; background: linear-gradient(90deg, transparent, #e5e5e5, transparent);"></div>
          </td>
        </tr>

        <!-- Logo/Brand -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 600; letter-spacing: -0.5px; color: #1d1d1f;">
              autoki
            </span>
          </td>
        </tr>

        <!-- Tagline -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #86868b; margin: 0;">
              Automation, die begeistert.
            </p>
          </td>
        </tr>

        <!-- Social Links -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 12px;">
                  <a href="https://linkedin.com/company/autoki" style="text-decoration: none;">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" width="20" height="20" style="display: block; opacity: 0.5;" />
                  </a>
                </td>
                <td style="padding: 0 12px;">
                  <a href="https://twitter.com/autoki" style="text-decoration: none;">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter" width="20" height="20" style="display: block; opacity: 0.5;" />
                  </a>
                </td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de" style="text-decoration: none;">
                    <img src="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" alt="Website" width="20" height="20" style="display: block; opacity: 0.5;" />
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Links -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 16px;">
                  <a href="https://autoki.de/impressum" style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #86868b; text-decoration: none;">
                    Impressum
                  </a>
                </td>
                <td style="color: #d2d2d7;">|</td>
                <td style="padding: 0 16px;">
                  <a href="https://autoki.de/datenschutz" style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #86868b; text-decoration: none;">
                    Datenschutz
                  </a>
                </td>
                <td style="color: #d2d2d7;">|</td>
                <td style="padding: 0 16px;">
                  <a href="mailto:hello@autoki.de" style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #86868b; text-decoration: none;">
                    Kontakt
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Address -->
        <tr>
          <td align="center" style="padding-bottom: 16px;">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.6; color: #86868b; margin: 0;">
              autoki GmbH · Musterstraße 1 · 10115 Berlin
            </p>
          </td>
        </tr>

        <!-- Copyright -->
        <tr>
          <td align="center">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #86868b; margin: 0;">
              © 2024 autoki. Alle Rechte vorbehalten.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail-Adresse erforderlich" },
        { status: 400 }
      );
    }

    // Full test email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 48px 40px 32px;">
              <h1 style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; color: #1d1d1f; margin: 0 0 16px;">
                E-Mail Footer Test
              </h1>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 17px; line-height: 1.6; color: #1d1d1f; margin: 0;">
                Dies ist eine Test-E-Mail, um den Footer zu überprüfen.
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #424245; margin: 0 0 24px;">
                Der Footer unten zeigt das minimalistische Design im Apple-Stil. Alle Elemente sind sorgfältig ausgewählt und aufeinander abgestimmt:
              </p>
              <ul style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.8; color: #424245; margin: 0; padding-left: 20px;">
                <li>Saubere Typografie mit SF Pro</li>
                <li>Dezente Farbpalette in Grautönen</li>
                <li>Großzügiges Spacing für Klarheit</li>
                <li>Subtile Social Media Icons</li>
                <li>Rechtliche Links diskret platziert</li>
              </ul>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  ${emailFooterHtml}

</body>
</html>
`;

    // Send email using Resend
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: "autoki <noreply@autoki.de>",
      to: [email],
      subject: "E-Mail Footer Test - autoki",
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test-E-Mail gesendet",
      id: data?.id,
    });
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json(
      {
        error: "Interner Fehler",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
